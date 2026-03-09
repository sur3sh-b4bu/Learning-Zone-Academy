const fs = require('fs');
const os = require('os');
const path = require('path');

const site = process.env.FB_HOSTING_SITE || 'nellailearningacademy';
const keepRecent = Number(process.env.KEEP_RECENT || 3);

function getToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return cfg?.tokens?.access_token;
}

async function main() {
  const token = getToken();
  if (!token) throw new Error('Missing CLI access token');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const chRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/projects/-/sites/${site}/channels/live`, { headers: authHeaders });
  const ch = await chRes.json();
  if (!chRes.ok) throw new Error(JSON.stringify(ch));
  const liveVersion = ch?.release?.version?.name || '';

  let versions = [];
  let pageToken = '';
  while (true) {
    const url = new URL(`https://firebasehosting.googleapis.com/v1beta1/projects/-/sites/${site}/versions`);
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    versions.push(...(data.versions || []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  versions.sort((a, b) => new Date(b.createTime || 0) - new Date(a.createTime || 0));

  const keep = new Set();
  if (liveVersion) keep.add(liveVersion);
  versions.slice(0, keepRecent).forEach((v) => keep.add(v.name));

  const deletable = versions.filter((v) => !keep.has(v.name));

  let deleted = 0;
  let failed = 0;
  let freedBytes = 0;

  for (const v of deletable) {
    const delUrl = `https://firebasehosting.googleapis.com/v1beta1/${v.name}`;
    const delRes = await fetch(delUrl, { method: 'DELETE', headers: authHeaders });

    if (delRes.ok) {
      deleted += 1;
      freedBytes += Number(v.versionBytes || 0);
    } else {
      failed += 1;
      const errBody = await delRes.text();
      console.error(`DELETE_FAILED ${v.name} ${delRes.status} ${errBody.slice(0, 300)}`);
    }

    if ((deleted + failed) % 10 === 0) {
      console.log(`Progress: ${deleted + failed}/${deletable.length}`);
    }
  }

  const result = {
    site,
    liveVersion,
    keepRecent,
    totalVersionsBefore: versions.length,
    requestedDelete: deletable.length,
    deleted,
    failed,
    estimatedFreedBytes: freedBytes,
    estimatedFreedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
    completedAt: new Date().toISOString(),
  };

  fs.writeFileSync('hosting-version-prune-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Prune failed:', err.message);
  process.exit(1);
});
