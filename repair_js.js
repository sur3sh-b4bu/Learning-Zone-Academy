const fs = require('fs');
const path = "c:/Temp/Gov learn weeb/js/main.js";
let content = fs.readFileSync(path, 'utf8');

// The current content starts with "function getPlanRank(rankMap, planId) {"
// because I deleted everything above it.

const header = `let subjects = [];
window.subjects = subjects;

function getPath(filename) {
    const isSubDir = window.location.pathname.includes('/html/');
    if (filename === 'index.html') return isSubDir ? '../index.html' : 'index.html';
    return (isSubDir ? '' : 'html/') + filename;
}

window.moveOTPFocus = (current, direction, context) => {
    const wrapper = current.parentElement;
    const inputs = Array.from(wrapper.querySelectorAll('.otp-digit'));
    const index = inputs.indexOf(current);
    const event = window.event || {};

    if (direction === 'next' && current.value.length === 1) {
        if (index < inputs.length - 1) inputs[index + 1].focus();
    } else if (direction === 'prev' && event.key === 'Backspace' && current.value.length === 0) {
        if (index > 0) inputs[index - 1].focus();
    }

    let code = "";
    inputs.forEach(i => { code += i.value; });
    const hiddenInput = document.getElementById(context + '-otp');
    if (hiddenInput) hiddenInput.value = code;
};

async function fetchSubjects() {
    try {
        const snapshot = await db.collection('subjects').orderBy('name').get();
        subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.subjects = subjects.map(s => s.name);
        return subjects;
    } catch (e) { console.error("Error fetching subjects:", e); return []; }
}

async function injectSubjects(filter = '') {
    const list = document.getElementById('subject-list');
    if (!list) return;
    if (subjects.length === 0) await fetchSubjects();
    list.innerHTML = '';
    const filtered = subjects.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'subject-item fade-in';
        item.textContent = subject.name;
        list.appendChild(item);
    });
}
window.fetchSubjects = fetchSubjects;

function normalizePlanId(planId) { return String(planId || 'free').trim().toLowerCase(); }

let planRankMapPromise = null;

async function getPlanRankMap() {
    if (planRankMapPromise) return planRankMapPromise;
    const fallback = { free: 0, pro: 1, ultimate: 2 };
    planRankMapPromise = (async () => {
        try {
            const snap = await db.collection('plans').orderBy('price', 'asc').get();
            if (snap.empty) return fallback;
            const map = {};
            let idx = 0;
            snap.forEach(doc => { map[normalizePlanId(doc.id)] = idx++; });
            if (map.free == null) map.free = 0;
            if (map.pro == null && idx > 1) map.pro = 1;
            if (map.ultimate == null && idx > 2) map.ultimate = 2;
            return map;
        } catch (e) { console.warn('Using fallback plan rank map:', e); return fallback; }
    })();
    return planRankMapPromise;
}

async function hasPlanAccess(userPlan, requiredPlan) {
    const required = normalizePlanId(requiredPlan || 'free');
    if (required === 'free') return true;
    const map = await getPlanRankMap();
    const userRank = getPlanRank(map, userPlan);
    const requiredRank = getPlanRank(map, required);
    return userRank >= requiredRank;
}

async function getCurrentUserPlanId() {
    const user = auth.currentUser;
    if (!user) return null;
    if (String(user.email || '').toLowerCase() === 'admin@gmail.com') return 'ultimate';
    try {
        const doc = await db.collection('students').doc(user.uid).get();
        if (!doc.exists) return 'free';
        return normalizePlanId(doc.data().plan || 'free');
    } catch (e) { return 'free'; }
}

async function verifyPlanAccess(requiredPlan) {
    const required = normalizePlanId(requiredPlan || 'free');
    if (required === 'free') return { allowed: true };
    const user = auth.currentUser;
    if (!user) return { allowed: false, reason: 'login', message: 'Please sign in.' };
    const userPlan = await getCurrentUserPlanId();
    const allowed = await hasPlanAccess(userPlan, required);
    if (allowed) return { allowed: true };
    return { allowed: false, reason: 'plan', message: 'Upgrade required.' };
}

`;

// Fix the file
fs.writeFileSync(path, header + content);
console.log("REPAIRED CORE JS");
