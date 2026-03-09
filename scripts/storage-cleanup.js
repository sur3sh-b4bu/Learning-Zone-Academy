const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ID = process.env.FB_PROJECT_ID || 'nellailearningacademy';
const BUCKET = process.env.FB_STORAGE_BUCKET || 'nellailearningacademy.firebasestorage.app';
const APPLY = process.argv.includes('--apply');

function readFirebaseCliToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`firebase-tools token file not found: ${cfgPath}`);
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const token = cfg?.tokens?.access_token;
  const expiresAt = Number(cfg?.tokens?.expires_at || 0);
  if (!token) throw new Error('No Firebase CLI access token found. Run: firebase login');
  if (Date.now() > expiresAt - 30_000) {
    throw new Error('Firebase CLI token is expired/expiring. Run: firebase login');
  }
  return token;
}

const ACCESS_TOKEN = readFirebaseCliToken();

async function apiFetch(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${url}\n${JSON.stringify(parsed).slice(0, 1000)}`);
  }
  return parsed;
}

function encodeDocPath(docPath) {
  return docPath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function normalizeStoragePath(value) {
  if (!value || typeof value !== 'string') return '';
  let s = value.trim();
  if (!s) return '';

  s = s.split('?')[0].split('#')[0];
  s = s.replace(/^\/+/, '');

  try {
    s = decodeURIComponent(s);
  } catch {
    // keep raw if malformed
  }
  return s.replace(/^\/+/, '');
}

function extractPathsFromString(rawValue, keyHint = '') {
  const out = new Set();
  if (typeof rawValue !== 'string') return out;
  const value = rawValue.trim();
  if (!value) return out;

  const add = (p) => {
    const norm = normalizeStoragePath(p);
    if (norm) out.add(norm);
  };

  const bucketEscaped = BUCKET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // gs://bucket/path
  const gsPrefix = `gs://${BUCKET}/`;
  if (value.startsWith(gsPrefix)) {
    add(value.slice(gsPrefix.length));
  }

  // Firebase storage download URL
  const fbUrlRegex = new RegExp(`https://firebasestorage\\.googleapis\\.com/v0/b/${bucketEscaped}/o/([^?]+)`, 'i');
  const fbMatch = value.match(fbUrlRegex);
  if (fbMatch && fbMatch[1]) {
    add(fbMatch[1]);
  }

  // storage.googleapis.com/bucket/path
  const gcsUrlRegex = new RegExp(`https://storage\\.googleapis\\.com/${bucketEscaped}/(.+)`, 'i');
  const gcsMatch = value.match(gcsUrlRegex);
  if (gcsMatch && gcsMatch[1]) {
    add(gcsMatch[1]);
  }

  // Raw path in fields like storagePath, pdfStoragePath, thumbnailStoragePath
  const keyLooksLikePath = /(storage|path|thumbnail|image|pdf|video|file)/i.test(keyHint);
  if (keyLooksLikePath && !/^https?:\/\//i.test(value) && !/^data:/i.test(value) && value.includes('/')) {
    if (value.startsWith(`${BUCKET}/`)) {
      add(value.slice(BUCKET.length + 1));
    } else {
      add(value);
    }
  }

  return out;
}

function walkFirestoreValue(value, keyPath, collector) {
  if (!value || typeof value !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) {
    const paths = extractPathsFromString(value.stringValue, keyPath);
    for (const p of paths) collector.add(p);
    return;
  }

  if (value.mapValue && value.mapValue.fields) {
    for (const [k, v] of Object.entries(value.mapValue.fields)) {
      walkFirestoreValue(v, keyPath ? `${keyPath}.${k}` : k, collector);
    }
    return;
  }

  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    value.arrayValue.values.forEach((item, idx) => walkFirestoreValue(item, `${keyPath}[${idx}]`, collector));
  }
}

function extractFromFirestoreFields(fields) {
  const refs = new Set();
  if (!fields || typeof fields !== 'object') return refs;
  for (const [k, v] of Object.entries(fields)) {
    walkFirestoreValue(v, k, refs);
  }
  return refs;
}

async function listCollectionIds(parentDocPath = '') {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  let pageToken = '';
  const ids = [];

  while (true) {
    const url = parentDocPath
      ? `${base}/${encodeDocPath(parentDocPath)}:listCollectionIds`
      : `${base}:listCollectionIds`;

    const body = {
      pageSize: 200,
      ...(pageToken ? { pageToken } : {}),
    };

    const res = await apiFetch(url, { method: 'POST', body });
    if (Array.isArray(res.collectionIds)) ids.push(...res.collectionIds);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return ids;
}

async function listDocuments(collectionPath) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const docs = [];
  let pageToken = '';

  while (true) {
    const url = new URL(`${base}/${encodeDocPath(collectionPath)}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await apiFetch(url.toString());
    if (Array.isArray(res.documents)) docs.push(...res.documents);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }

  return docs;
}

async function collectReferencedStoragePaths() {
  const referenced = new Set();
  const visitedDocs = new Set();
  let scannedDocCount = 0;

  async function traverse(parentDocPath = '') {
    const collectionIds = await listCollectionIds(parentDocPath);
    for (const collectionId of collectionIds) {
      const collectionPath = parentDocPath ? `${parentDocPath}/${collectionId}` : collectionId;
      const docs = await listDocuments(collectionPath);

      for (const doc of docs) {
        const relDocPath = String(doc.name || '').split('/documents/')[1] || '';
        if (!relDocPath || visitedDocs.has(relDocPath)) continue;

        visitedDocs.add(relDocPath);
        scannedDocCount += 1;

        const refs = extractFromFirestoreFields(doc.fields || {});
        for (const p of refs) referenced.add(normalizeStoragePath(p));

        await traverse(relDocPath);
      }
    }
  }

  await traverse('');
  return { referenced, scannedDocCount };
}

async function listStorageObjects() {
  const objects = [];
  let pageToken = '';

  while (true) {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o`);
    url.searchParams.set('maxResults', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await apiFetch(url.toString());
    if (Array.isArray(res.items)) objects.push(...res.items);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }

  return objects;
}

function findDuplicateGroups(objects) {
  const groups = new Map();
  for (const obj of objects) {
    const size = Number(obj.size || 0);
    const md5 = obj.md5Hash || '';
    if (!md5 || !size) continue;
    const key = `${md5}:${size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(obj);
  }

  const duplicates = [];
  for (const [, group] of groups.entries()) {
    if (group.length > 1) {
      group.sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0));
      duplicates.push(group);
    }
  }
  return duplicates;
}

async function deleteObjectByName(name) {
  const encoded = encodeURIComponent(name);
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o/${encoded}`;
  await apiFetch(url, { method: 'DELETE' });
}

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(2)} KB`;
  if (b < 1024 ** 3) return `${(b / (1024 ** 2)).toFixed(2)} MB`;
  return `${(b / (1024 ** 3)).toFixed(2)} GB`;
}

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Mode: ${APPLY ? 'APPLY (delete)' : 'DRY-RUN'}`);

  const { referenced, scannedDocCount } = await collectReferencedStoragePaths();
  console.log(`Firestore docs scanned: ${scannedDocCount}`);
  console.log(`Referenced storage paths found: ${referenced.size}`);

  const objects = await listStorageObjects();
  const normalizedReferenced = new Set(Array.from(referenced).map(normalizeStoragePath));

  const referencedObjects = [];
  const unreferencedObjects = [];

  for (const obj of objects) {
    const name = normalizeStoragePath(obj.name || '');
    if (!name) continue;
    if (normalizedReferenced.has(name)) referencedObjects.push(obj);
    else unreferencedObjects.push(obj);
  }

  const dupGroupsAll = findDuplicateGroups(objects);
  const dupGroupsUnref = findDuplicateGroups(unreferencedObjects);

  const totalBytes = objects.reduce((acc, o) => acc + Number(o.size || 0), 0);
  const unrefBytes = unreferencedObjects.reduce((acc, o) => acc + Number(o.size || 0), 0);

  const report = {
    generatedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET,
    firestoreDocsScanned: scannedDocCount,
    referencedPathCount: normalizedReferenced.size,
    storageObjectCount: objects.length,
    referencedObjectCount: referencedObjects.length,
    unreferencedObjectCount: unreferencedObjects.length,
    totalBytes,
    unreferencedBytes: unrefBytes,
    totalReadable: formatBytes(totalBytes),
    unreferencedReadable: formatBytes(unrefBytes),
    duplicateGroupsAll: dupGroupsAll.length,
    duplicateGroupsUnreferenced: dupGroupsUnref.length,
    sampleUnreferenced: unreferencedObjects.slice(0, 50).map((o) => ({ name: o.name, size: o.size, updated: o.updated })),
  };

  fs.writeFileSync('storage-cleanup-report.json', JSON.stringify(report, null, 2));
  fs.writeFileSync('storage-unreferenced-objects.json', JSON.stringify(unreferencedObjects, null, 2));

  console.log('--- Audit Summary ---');
  console.log(`Total objects: ${objects.length}`);
  console.log(`Referenced objects: ${referencedObjects.length}`);
  console.log(`Unreferenced objects: ${unreferencedObjects.length}`);
  console.log(`Total storage: ${formatBytes(totalBytes)}`);
  console.log(`Unreferenced storage: ${formatBytes(unrefBytes)}`);
  console.log(`Duplicate groups (all): ${dupGroupsAll.length}`);
  console.log(`Duplicate groups (unreferenced): ${dupGroupsUnref.length}`);
  console.log('Report files: storage-cleanup-report.json, storage-unreferenced-objects.json');

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to delete unreferenced objects.');
    return;
  }

  if (objects.length >= 20 && referencedObjects.length === 0) {
    throw new Error('Safety stop: 0 referenced objects detected while bucket has many files. Aborting delete.');
  }

  let deleted = 0;
  let failed = 0;
  for (const obj of unreferencedObjects) {
    try {
      await deleteObjectByName(obj.name);
      deleted += 1;
      if (deleted % 25 === 0) {
        console.log(`Deleted ${deleted}/${unreferencedObjects.length}...`);
      }
    } catch (err) {
      failed += 1;
      console.warn(`Failed to delete ${obj.name}: ${err.message}`);
    }
  }

  const result = {
    deleted,
    failed,
    requested: unreferencedObjects.length,
    deletedBytesEstimate: unrefBytes,
    deletedBytesReadableEstimate: formatBytes(unrefBytes),
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync('storage-cleanup-delete-result.json', JSON.stringify(result, null, 2));

  console.log('--- Delete Summary ---');
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
  console.log(`Estimated freed: ${formatBytes(unrefBytes)}`);
  console.log('Result file: storage-cleanup-delete-result.json');
}

main().catch((err) => {
  console.error('Cleanup script failed:', err.message);
  process.exit(1);
});
