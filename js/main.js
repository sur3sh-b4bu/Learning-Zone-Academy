let subjects = [];
window.subjects = subjects;

// Admin Configuration
const ADMIN_EMAIL = 'admin@gmail.com'; // Change this to your actual email

function getPath(filename) {
    const isSubDir = window.location.pathname.includes('/html/');
    if (filename === 'index.html') {
        return isSubDir ? '../index.html' : 'index.html';
    }
    return (isSubDir ? '' : 'html/') + filename;
}

window.moveOTPFocus = (current, direction, context) => {
    const wrapper = current.parentElement;
    const inputs = Array.from(wrapper.querySelectorAll('.otp-digit'));
    const index = inputs.indexOf(current);
    const ev = window.event;

    if (direction === 'next' && current.value.length === 1) {
        if (index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    } else if (direction === 'prev' && ev && (ev.key === 'Backspace' || ev.keyCode === 8) && current.value.length === 0) {
        if (index > 0) {
            inputs[index - 1].focus();
        }
    }

    // Sync to hidden input
    let code = "";
    inputs.forEach(i => { code += i.value; });
    const hiddenInput = document.getElementById(context + '-otp');
    if (hiddenInput) {
        hiddenInput.value = code;
        // Trigger verification if 6 digits entered
        if (code.length === 6) {
            if (context === 'onboarding' && typeof verifyOnboardingOTP === 'function') {
                // We'll let the user click the button to be safe, or we could auto-trigger
            }
        }
    }
};

async function fetchSubjects() {
    try {
        const snapshot = await db.collection('subjects').orderBy('name').get();
        subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.subjects = subjects.map(s => s.name); // Keep backward compatibility for simple array
        return subjects;
    } catch (e) {
        console.error("Error fetching subjects:", e);
        return [];
    }
}

async function injectSubjects(filter = '') {
    const list = document.getElementById('subject-list');
    if (!list) return;

    if (subjects.length === 0) {
        await fetchSubjects();
    }

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

function normalizePlanId(planId) {
    return String(planId || 'free').trim().toLowerCase();
}

function parsePlanPriceValue(priceValue) {
    if (typeof priceValue === 'number') {
        return Number.isFinite(priceValue) ? priceValue : Number.POSITIVE_INFINITY;
    }
    const cleaned = String(priceValue == null ? '' : priceValue).replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

let planRankMapPromise = null;

async function getPlanRankMap() {
    if (planRankMapPromise) return planRankMapPromise;

    const fallback = { free: 0, pro: 1, ultimate: 2 };
    planRankMapPromise = (async () => {
        try {
            const snap = await db.collection('plans').get();
            if (snap.empty) return fallback;

            const plans = snap.docs.map(doc => {
                const data = doc.data() || {};
                return {
                    id: normalizePlanId(doc.id),
                    price: parsePlanPriceValue(data.price)
                };
            });
            plans.sort((a, b) => {
                if (a.price !== b.price) return a.price - b.price;
                return a.id.localeCompare(b.id);
            });

            const map = {};
            let idx = 0;
            plans.forEach(plan => {
                map[plan.id] = idx++;
            });

            if (map.free == null) map.free = 0;
            if (map.pro == null && idx > 1) map.pro = 1;
            if (map.ultimate == null && idx > 2) map.ultimate = 2;
            return map;
        } catch (e) {
            console.warn('Using fallback plan rank map:', e);
            return fallback;
        }
    })();

    return planRankMapPromise;
}

function getPlanRank(rankMap, planId) {
    const normalized = normalizePlanId(planId);
    if (rankMap[normalized] != null) return rankMap[normalized];

    const staticRank = {
        free: 0, basic: 0, starter: 0,
        pro: 1, plus: 1, premium: 1,
        ultimate: 2, diamond: 3, platinum: 4, enterprise: 5
    };

    if (staticRank[normalized] != null) return staticRank[normalized];
    if (normalized.includes('free')) return 0;
    if (normalized.includes('pro') || normalized.includes('premium')) return 1;
    if (normalized.includes('ultimate')) return 2;
    return 1;
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
    // Hardcoded admin bypass for access checks.
    if (String(user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) return 'ultimate';

    try {
        const doc = await db.collection('students').doc(user.uid).get();
        if (!doc.exists) return 'free';
        return normalizePlanId(doc.data().plan || 'free');
    } catch (e) {
        console.warn('Failed to fetch current user plan, defaulting to free:', e);
        return 'free';
    }
}

async function verifyPlanAccess(requiredPlan) {
    const required = normalizePlanId(requiredPlan || 'free');
    if (required === 'free') return { allowed: true };

    const user = auth.currentUser;
    if (!user) {
        return {
            allowed: false,
            reason: 'login',
            message: `Please sign in to access ${required.toUpperCase()} content.`
        };
    }

    const userPlan = await getCurrentUserPlanId();
    const allowed = await hasPlanAccess(userPlan, required);
    if (allowed) return { allowed: true };

    return {
        allowed: false,
        reason: 'plan',
        message: `Upgrade required.\n\nThis content requires ${required.toUpperCase()} plan access.`
    };
}

window.handlePlanLockedAsset = async (event, targetUrl, requiredPlan, label = 'content') => {
    if (event) event.preventDefault();
    const url = targetUrl || '#';

    if (url === '#') {
        alert(`No ${label} link available.`);
        return false;
    }

    const result = await verifyPlanAccess(requiredPlan);
    if (!result.allowed) {
        alert(result.message);
        if (result.reason === 'login') {
            toggleModal('login-modal');
        } else {
            const pricingPath = window.location.pathname.includes('/html/') ? '../index.html#pricing' : 'index.html#pricing';
            window.location.href = pricingPath;
        }
        return false;
    }

    window.open(url, '_blank', 'noopener');
    return false;
};

function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        console.error('Modal with ID not found:', id);
        return;
    }

    // Get current display state
    const currentDisplay = modal.style.display;
    const isVisible = currentDisplay === 'flex';

    if (isVisible) {
        // Hide modal
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        // Show modal - force display flex
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Close mobile menu when opening modal
        const nav = document.querySelector('nav');
        const navLinks = document.querySelector('.nav-links');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        const mobilePanel = document.querySelector('.mobile-nav-panel');
        if (nav) nav.classList.remove('mobile-active');
        if (navLinks) navLinks.classList.remove('active');
        if (toggleBtn) toggleBtn.classList.remove('active');
        if (mobilePanel) mobilePanel.classList.remove('active');
    }
}

function toggleNav() {
    const nav = document.querySelector('nav');
    const navLinks = document.querySelector('.nav-links');
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    const mobilePanel = document.querySelector('.mobile-nav-panel');

    const isActive = mobilePanel && mobilePanel.classList.toggle('active');
    if (nav) nav.classList.toggle('mobile-active', isActive);
    if (toggleBtn) toggleBtn.classList.toggle('active', isActive);
    if (navLinks) navLinks.classList.toggle('active', isActive);

    document.body.style.overflow = isActive ? 'hidden' : '';
}

function toggleMoreNav() {
    const navSecondary = document.querySelector('.nav-secondary');
    if (navSecondary) {
        navSecondary.classList.toggle('active');
    }
}

window.toggleModal = toggleModal;
window.toggleNav = toggleNav;
window.toggleMoreNav = toggleMoreNav;

window.logout = async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout failed:", error);
    }
};


// Close mobile menu when clicking a link or button
window.addEventListener('load', () => {
    document.addEventListener('click', (e) => {
        const navLinks = document.querySelector('.nav-links');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        const mobilePanel = document.querySelector('.mobile-nav-panel');
        const clickedLink = e.target.closest('.nav-links a') || e.target.closest('.nav-links button') || e.target.closest('.mobile-nav-content a');

        if (clickedLink) {
            const nav = document.querySelector('nav');
            if (nav) nav.classList.remove('mobile-active');
            if (navLinks) navLinks.classList.remove('active');
            if (toggleBtn) toggleBtn.classList.remove('active');
            if (mobilePanel) mobilePanel.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});



// Close modal when clicking outside
window.onclick = function (event) {
    if (event.target.className === 'modal-overlay') {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Simple dynamic nav scrolling
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (!nav) return;
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});


// ==========================================
// THEME MANAGEMENT (Spectrum Sync)
// ==========================================
window.toggleTheme = function () {
    const isLight = document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
};

function updateThemeIcon(isLight) {
    const icons = document.querySelectorAll('.theme-toggle i');
    icons.forEach(icon => {
        icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
    });
}

// Initial Theme Application (Runs immediately to prevent flash)
(function () {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    injectSubjects();
    const isLight = document.documentElement.classList.contains('light-mode');
    updateThemeIcon(isLight);
});

// Re-sync icon after nav loads
window.addEventListener('navLoaded', () => {
    const isLight = document.documentElement.classList.contains('light-mode');
    updateThemeIcon(isLight);
});

window.currentUserIsAdmin = false;

function isTruthyAdminFlag(value) {
    if (value === true) return true;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    if (typeof value === 'number') return value === 1;
    return false;
}

function hasAdminAccess(user, studentData = {}) {
    const emailMatch = String((user && user.email) || '').trim().toLowerCase() === String(ADMIN_EMAIL || '').trim().toLowerCase();
    const adminFlag = isTruthyAdminFlag(studentData.isAdmin);
    const normalizedRole = String(studentData.role || '').trim().toLowerCase();
    const roleFlag = normalizedRole === 'admin' || normalizedRole === 'super admin' || normalizedRole === 'superadmin';
    return emailMatch || adminFlag || roleFlag;
}

// Auth State Handling
// Auth State UI Synchronization
function updateNavUI(user, isAdmin = false) {
    const loginBtns = document.querySelectorAll('.login-toggle-btn');
    const isProfilePage = window.location.pathname.includes('profile.html');

    if (user) {
        // Update login buttons
        loginBtns.forEach(btn => {
            if (isProfilePage) {
                btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Logout</span>';
                btn.onclick = (e) => { e.preventDefault(); logout(); }
            } else {
                btn.style.display = 'none';
                if (btn.parentElement && btn.parentElement.id === 'login-nav-item') {
                    btn.parentElement.style.display = 'none';
                }
            }
        });

        // Add Profile and Logout to nav if not already there
        const navLinks = document.querySelector('.nav-links');
        const navActions = document.querySelector('.nav-actions');

        if (navLinks && !isProfilePage) {
            if (!document.getElementById('profile-nav-link')) {
                const profileLi = document.createElement('li');
                profileLi.id = 'profile-nav-link';
                profileLi.innerHTML = `<a href="${getPath('profile.html')}" class="nav-item"><i class="fas fa-user-circle"></i> Profile</a>`;
                navLinks.appendChild(profileLi);
            }
        }

        if (navLinks) {
            const adminDashboardLink = document.getElementById('admin-dashboard-link');
            if (isAdmin) {
                if (!adminDashboardLink) {
                    const adminLi = document.createElement('li');
                    adminLi.id = 'admin-dashboard-link';
                    adminLi.innerHTML = `<a href="${getPath('admin.html')}" class="nav-item"><i class="fas fa-user-shield"></i> Admin Console</a>`;
                    navLinks.appendChild(adminLi);
                } else {
                    adminDashboardLink.style.display = '';
                }
            } else if (adminDashboardLink) {
                adminDashboardLink.remove();
            }
        }

        if (navActions && !isProfilePage) {
            if (!document.getElementById('logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logout-btn';
                logoutBtn.className = 'btn-primary btn-logout';
                logoutBtn.type = 'button';
                logoutBtn.onclick = logout;
                logoutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> <span>Logout</span>`;

                const hamburger = navActions.querySelector('.mobile-menu-toggle');
                if (hamburger) {
                    navActions.insertBefore(logoutBtn, hamburger);
                } else {
                    navActions.appendChild(logoutBtn);
                }
            }
        }

        // Also add Profile and Logout to mobile panel
        const mobileContent = document.querySelector('.mobile-nav-content');
        const mobileFooter = document.querySelector('.mobile-nav-footer');

        if (mobileContent && !isProfilePage) {
            if (!document.getElementById('mobile-profile-link')) {
                const profileA = document.createElement('a');
                profileA.id = 'mobile-profile-link';
                profileA.href = getPath('profile.html');
                profileA.innerHTML = '<i class="fas fa-user-circle"></i> Profile';
                profileA.style.order = "98"; // Ensure it stays near the end of links

                if (mobileFooter) {
                    mobileContent.insertBefore(profileA, mobileFooter);
                } else {
                    mobileContent.appendChild(profileA);
                }
            }
        }

        if (mobileContent) {
            const mobileAdminLink = document.getElementById('mobile-admin-link');
            if (isAdmin) {
                if (!mobileAdminLink) {
                    const adminA = document.createElement('a');
                    adminA.id = 'mobile-admin-link';
                    adminA.href = getPath('admin.html');
                    adminA.innerHTML = '<i class="fas fa-user-shield"></i> Admin Console';
                    adminA.style.order = "97";

                    if (mobileFooter) {
                        mobileContent.insertBefore(adminA, mobileFooter);
                    } else {
                        mobileContent.appendChild(adminA);
                    }
                }
            } else if (mobileAdminLink) {
                mobileAdminLink.remove();
            }
        }

        if (mobileFooter && !isProfilePage) {
            if (!document.getElementById('mobile-logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'mobile-logout-btn';
                logoutBtn.type = 'button';
                logoutBtn.className = 'btn-primary login-toggle-btn w-full btn-logout';
                logoutBtn.onclick = () => { logout(); toggleNav(); };
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                mobileFooter.appendChild(logoutBtn);
            }
        }
    } else {
        // Cleanup UI
        const profileLink = document.getElementById('profile-nav-link');
        const logoutBtn = document.getElementById('logout-btn');
        const mobileProfileLink = document.getElementById('mobile-profile-link');
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        const adminDashboardLink = document.getElementById('admin-dashboard-link');
        const mobileAdminLink = document.getElementById('mobile-admin-link');

        if (profileLink) profileLink.remove();
        if (logoutBtn) logoutBtn.remove();
        if (mobileProfileLink) mobileProfileLink.remove();
        if (mobileLogoutBtn) mobileLogoutBtn.remove();
        if (adminDashboardLink) adminDashboardLink.remove();
        if (mobileAdminLink) mobileAdminLink.remove();
        loginBtns.forEach(btn => {
            btn.style.display = 'inline-flex';
            if (btn.parentElement && btn.parentElement.id === 'login-nav-item') {
                btn.parentElement.style.display = '';
            }
            btn.innerHTML = '<i class="fas fa-user"></i> <span>Sign In</span>';
            btn.onclick = (e) => { e.preventDefault(); toggleModal('login-modal'); }
        });
    }
}

// Global state to track current user for nav sync
window.currentUser = null;

auth.onAuthStateChanged(async (user) => {
    window.currentUser = user;
    let isAdminUser = false;

    if (user) {
        try {
            const userRef = db.collection('students').doc(user.uid);
            const userSnap = await userRef.get();
            const userData = userSnap.exists ? (userSnap.data() || {}) : {};
            isAdminUser = hasAdminAccess(user, userData);

            if (!userSnap.exists) {
                const finalName = user.displayName || 'Learner';
                await userRef.set({
                    name: finalName, email: user.email, plan: 'free',
                    enrolled: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await userRef.set({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
        } catch (e) {
            console.error("Error saving user:", e);
            isAdminUser = hasAdminAccess(user, {});
        }
    }

    window.currentUserIsAdmin = isAdminUser;
    updateNavUI(user, isAdminUser);
});

// Sync UI when navigation finishes loading
window.addEventListener('navLoaded', () => {
    updateNavUI(window.currentUser, window.currentUserIsAdmin === true);
    attachFormListeners();
});

function attachFormListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = emailSignIn;

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.onsubmit = startSignupFlow;

    document.querySelectorAll('.google-btn').forEach(btn => {
        btn.onclick = googleSignIn;
    });
}


window.googleSignIn = async () => {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        console.log("Logged in:", result.user);
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
            window.location.href = getPath('profile.html');
        }
    } catch (error) {
        handleAuthError(error);
    }
};

function handleAuthError(error) {
    console.error("Auth error details:", error);
    const errorCode = String(error && error.code || '');
    const errorMessage = String(error && error.message || 'Unknown error');
    const errorString = JSON.stringify(error, null, 2);

    if (errorCode === 'auth/operation-not-supported-in-this-environment') {
        alert("Security Error: Social login not supported here. Use HTTPS.");
        return;
    }

    if (errorCode === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        const rootDomain = currentDomain.replace(/^www\./, '');
        alert(`Google login is blocked for this domain.\n\nAdd both '${currentDomain}' and '${rootDomain}' in Firebase Authentication -> Authorized domains, then try again.`);
        return;
    }

    if (
        errorCode === 'auth/internal-error' ||
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/cancelled-popup-request' ||
        (errorMessage && errorMessage.includes('auth/internal-error'))
    ) {
        // Popup can fail in strict browsers; redirect-based auth is more reliable.
        auth.signInWithRedirect(googleProvider).catch((redirectErr) => {
            console.error('Google redirect fallback failed:', redirectErr);
            alert(`Google login failed.\n\n${redirectErr.message || 'Please retry or use email login.'}`);
        });
        return;
    }

    if (errorCode === 'auth/popup-closed-by-user') {
        // Intentional user action; keep silent to avoid noise.
        return;
    } else {
        alert("Login failed: " + errorMessage + "\n\nDebug: " + errorString);
    }
}


window.emailSignIn = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    // Clear previous errors/visuals if any
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        // Success
        toggleModal('login-modal');
        // If on index, redirect to profile
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
            window.location.href = getPath('profile.html');
        } else {
            location.reload();
        }
    } catch (error) {
        console.error("Login sync failed:", error.code);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            alert("Security Alert: The email address or password you entered is incorrect. Please try again or use the 'Forgot Password' link.");
        } else if (error.code === 'auth/too-many-requests') {
            alert("Security Protocol: Access temporarily frozen due to too many failed attempts. Please reset your password or try again later.");
        } else {
            handleAuthError(error);
        }
    }
};

window.sendResetLink = async () => {
    const email = document.getElementById('forgot-email').value;
    if (!email) { alert("Please enter your registered email address."); return; }

    try {
        await auth.sendPasswordResetEmail(email);
        alert("Password reset email sent! Please check your inbox (and spam folder) for a link to reset your password.");
        toggleModal('forgot-password-modal');
        toggleModal('login-modal'); // Take them back to sign in
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            alert("No account found with this email address. Please check and try again.");
        } else {
            alert("Failed to send reset email: " + error.message);
        }
    }
};

window.startSignupFlow = async () => {
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;

    if (!name || !email || !pass) { alert("Please complete all registration fields."); return; }

    // PASSWORD STRENGTH VALIDATOR (Cyber-Security Grade)
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(pass)) {
        alert("SECURITY PROTOCOL: Your password is not strong enough.\n\nIt must contain:\n• At least 8 characters\n• At least one uppercase letter (A-Z)\n• At least one lowercase letter (a-z)\n• At least one number (0-9)\n• At least one special symbol (@$!%*?&)");
        return;
    }

    // Check if email already exists in Firestore/Auth
    try {
        const methods = await auth.fetchSignInMethodsForEmail(email);
        if (methods.length > 0) {
            alert("Identity Conflict: A student is already registered with this email. Please sign in or use a different address.");
            return;
        }

        // Proceed to OTP Step
        const res = await fetch('https://asia-south1-nellailearningacademy.cloudfunctions.net/sendVerificationOTP', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const data = await res.json();

        if (data.ok) {
            document.getElementById('display-signup-email').textContent = email;
            document.getElementById('signup-step-1').style.display = 'none';
            document.getElementById('signup-step-otp').style.display = 'block';
        } else {
            alert("Verification Link Failed: " + (data.error || "Please try again."));
        }
    } catch (error) {
        alert("Security Sync Error: " + error.message);
    }
};

window.verifySignupOTP = async () => {
    let otp = "";
    document.querySelectorAll('#signup-modal .otp-digit').forEach(input => otp += input.value);

    if (otp.length < 6) { alert("Please enter the 6-digit sync code."); return; }

    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const qualification = document.getElementById('signup-qualification').value;
    const address = document.getElementById('signup-address').value;

    try {
        const res = await fetch('https://asia-south1-nellailearningacademy.cloudfunctions.net/verifySignupOTP', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();

        if (data.ok) {
            // OTP verified, now create actual Auth account
            const userCred = await auth.createUserWithEmailAndPassword(email, pass);
            await userCred.user.updateProfile({ displayName: name });

            // Sync with Firestore
            await db.collection('students').doc(userCred.user.uid).set({
                name, email, phone, qualification, address,
                plan: 'free',
                onboardingCompleted: true,
                enrolled: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Account Synchronized: Welcome to Nellai Learning Academy!");
            window.location.href = getPath('profile.html');
        } else {
            alert(data.error || "Invalid synchronization code.");
        }
    } catch (error) {
        alert("Verification System Error: " + error.message);
    }
};

window.resendSignupOTP = () => {
    document.querySelectorAll('#signup-modal .otp-digit').forEach(input => input.value = '');
    document.querySelectorAll('#signup-modal .otp-digit')[0]?.focus();
    startSignupFlow();
};

window.goToSignupStep = (n) => {
    if (n === 1) {
        document.getElementById('signup-step-1').style.display = 'block';
        document.getElementById('signup-step-otp').style.display = 'none';
    }
};

// Update all Google buttons and Forms to use these functions
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.google-btn').forEach(btn => {
        btn.onclick = googleSignIn;
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.onsubmit = emailSignIn;

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.onsubmit = startSignupFlow;

    const forgotForm = document.getElementById('forgot-password-form');
    if (forgotForm) forgotForm.onsubmit = sendResetLink;
});

// ==========================================
// DYNAMIC CONTENT RENDERING (Videos & Materials)
// ==========================================

async function fetchAndApplySEO() {
    const seoDoc = await db.collection('siteConfig').doc('seo').get().catch(() => null);
    if (!seoDoc || !seoDoc.exists) return;

    const data = seoDoc.data() || {};
    const head = document.head;
    if (!head) return;

    const upsertMetaByName = (name, content) => {
        if (!name || !content) return;
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', name);
            head.appendChild(meta);
        }
        meta.setAttribute('content', String(content));
    };

    const upsertMetaByProperty = (property, content) => {
        if (!property || !content) return;
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('property', property);
            head.appendChild(meta);
        }
        meta.setAttribute('content', String(content));
    };

    const upsertLink = (rel, href) => {
        if (!rel || !href) return;
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', rel);
            head.appendChild(link);
        }
        link.setAttribute('href', String(href));
    };

    const toAbsoluteUrl = (value) => {
        if (!value) return '';
        try {
            return new URL(String(value).trim(), window.location.origin).href;
        } catch (_) {
            return '';
        }
    };

    const canonicalBaseUrlRaw = String(data.canonicalBaseUrl || window.location.origin || '').trim();
    const canonicalBaseUrl = toAbsoluteUrl(canonicalBaseUrlRaw);
    let canonicalUrl = '';
    if (canonicalBaseUrl) {
        try {
            const current = new URL(window.location.href);
            const base = new URL(canonicalBaseUrl);
            let path = current.pathname || '/';

            const basePath = String(base.pathname || '/').replace(/\/+$/, '');
            if (basePath && basePath !== '/' && !path.startsWith(basePath + '/')) {
                path = `${basePath}${path.startsWith('/') ? '' : '/'}${path}`;
            }
            path = path.replace(/\/index\.html$/i, '/');

            const canonical = new URL(base.origin);
            canonical.pathname = path;
            canonical.search = '';
            canonical.hash = '';
            canonicalUrl = canonical.href;
        } catch (_) { }
    }

    // Keep an immutable base page title so repeated calls don't append suffix multiple times.
    const root = document.documentElement;
    const storedBaseTitle = root.getAttribute('data-seo-base-title');
    const baseTitle = (storedBaseTitle || document.title || '').trim();
    if (!storedBaseTitle) {
        root.setAttribute('data-seo-base-title', baseTitle);
    }

    const siteName = String(data.siteName || '').trim();
    let finalTitle = baseTitle;
    if (siteName) {
        if (!baseTitle) finalTitle = siteName;
        else if (!baseTitle.toLowerCase().includes(siteName.toLowerCase())) finalTitle = `${baseTitle} | ${siteName}`;
    }
    if (finalTitle) document.title = finalTitle;

    const description = String(data.description || '').trim();
    const keywords = String(data.keywords || '').trim();
    const author = String(data.author || '').trim();
    const robots = String(data.robots || 'index, follow').trim();
    const ogTitle = String(data.ogTitle || finalTitle || '').trim();
    const ogDescription = String(data.ogDescription || description || '').trim();
    const ogImage = toAbsoluteUrl(data.ogImage);
    const twitterHandleRaw = String(data.twitterHandle || '').trim();
    const twitterHandle = twitterHandleRaw ? `@${twitterHandleRaw.replace(/^@+/, '')}` : '';

    if (keywords) upsertMetaByName('keywords', keywords);
    if (description) upsertMetaByName('description', description);
    if (author) upsertMetaByName('author', author);
    if (robots) upsertMetaByName('robots', robots);

    if (data.googleVerificationCode) {
        upsertMetaByName('google-site-verification', String(data.googleVerificationCode).trim());
    }
    if (data.bingVerificationCode) {
        upsertMetaByName('msvalidate.01', String(data.bingVerificationCode).trim());
    }

    if (canonicalUrl) upsertLink('canonical', canonicalUrl);

    if (ogTitle) upsertMetaByProperty('og:title', ogTitle);
    if (ogDescription) upsertMetaByProperty('og:description', ogDescription);
    if (canonicalUrl) upsertMetaByProperty('og:url', canonicalUrl);
    if (siteName) upsertMetaByProperty('og:site_name', siteName);
    upsertMetaByProperty('og:type', 'website');
    if (ogImage) upsertMetaByProperty('og:image', ogImage);

    const twitterCard = ogImage ? 'summary_large_image' : 'summary';
    upsertMetaByName('twitter:card', twitterCard);
    if (twitterHandle) upsertMetaByName('twitter:site', twitterHandle);
    if (ogTitle) upsertMetaByName('twitter:title', ogTitle);
    if (ogDescription) upsertMetaByName('twitter:description', ogDescription);
    if (ogImage) upsertMetaByName('twitter:image', ogImage);

    // Lightweight Organization schema for richer search understanding.
    const schemaId = 'dynamic-org-schema';
    const schemaEl = document.getElementById(schemaId) || document.createElement('script');
    schemaEl.id = schemaId;
    schemaEl.type = 'application/ld+json';
    const orgSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": siteName || 'NellaiLearningAcademy',
        "url": canonicalBaseUrl || window.location.origin,
        "logo": ogImage || `${window.location.origin}/logo1.png`
    };
    schemaEl.textContent = JSON.stringify(orgSchema);
    if (!schemaEl.parentNode) head.appendChild(schemaEl);
}
window.fetchAndApplySEO = fetchAndApplySEO;

async function fetchAndRenderVideos() {
    const container = document.getElementById('videos-container');
    if (!container) return; // Only run on videos.html

    try {
        const snapshot = await db.collection('videos').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: rgba(255, 255, 255, 0.8);">No videos currently available.</div>';
            return;
        }

        container.innerHTML = ''; // Clear loading spinner

        snapshot.forEach(doc => {
            const data = doc.data();
            const requiredPlan = normalizePlanId(data.requiredPlan || 'free');
            const isLockedPlan = requiredPlan !== 'free';
            const courseUrl = `${getPath('video-view.html')}?course=${encodeURIComponent(doc.id)}`;
            const safeCourseUrl = courseUrl.replace(/'/g, "\\'");

            const externalStyles = isLockedPlan
                ? 'border: 2px solid transparent; background: linear-gradient(white, white) padding-box, linear-gradient(135deg, var(--primary-light), var(--accent-teal)) border-box;'
                : '';
            const badgeType = isLockedPlan
                ? `<span class="badge" style="background: linear-gradient(135deg, var(--primary-light), var(--accent-teal)); color: var(--primary-dark);">${requiredPlan.toUpperCase()}+</span>`
                : '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.8);">Free</span>';
            const actionBtn = isLockedPlan
                ? `<a href="#" class="btn-primary" style="display: block; text-align: center; margin-top: 16px; background: linear-gradient(135deg, var(--primary-green), var(--accent-teal));" onclick="return handlePlanLockedAsset(event, '${safeCourseUrl}', '${requiredPlan}', 'video');">Unlock ${requiredPlan.toUpperCase()}</a>`
                : `<a href="${courseUrl}" class="btn-primary" style="display: block; text-align: center; margin-top: 16px;">Watch Now</a>`;
            const premiumOverlay = isLockedPlan
                ? `<div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); padding: 4px 12px; border-radius: 20px; color: gold; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">⭐ ${requiredPlan.toUpperCase()}</div>`
                : '';

            const fallbackImg = "https://images.unsplash.com/photo-1577493340887-b7bfff550145?auto=format&fit=crop&q=80";

            const cardHTML = `
                <div class="video-card glass" style="${externalStyles}">
                    <div class="video-thumbnail">
                        <img src="${data.thumbnailUrl || fallbackImg}" alt="${data.title} thumbnail">
                        <div class="play-overlay">
                            <i class="fas fa-play play-icon"></i>
                        </div>
                        <span class="video-duration">${data.duration || '00:00'}</span>
                        ${premiumOverlay}
                    </div>
                    <div class="video-info">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--primary-green);">${data.subject || 'General'}</span>
                            ${badgeType}
                        </div>
                        <h3>${data.title}</h3>
                        <p>${data.description || 'No description provided.'}</p>
                        <div class="video-meta">
                            <span>${data.teacherName || 'Instructor'}</span>
                            <span>• New</span>
                        </div>
                        ${actionBtn}
                    </div>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    } catch (error) {
        console.error("Error fetching videos:", error);
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: rgba(255, 255, 255, 0.8);">Failed to load videos. Please try again later.</div>';
    }
}
async function fetchAndRenderMaterials(filterText = '', filterCat = 'all') {
    const container = document.getElementById('materials-container');
    if (!container) return; // Only run on materials.html

    function getColorForSubject(subject) {
        const colors = { 'Tamil': '#059669', 'English': '#3b82f6', 'Maths': '#f59e0b', 'Reasoning': '#8b5cf6', 'History': '#ec4899', 'Polity': '#06b6d4', 'Science': '#10b981', 'Geography': '#6366f1', 'Current Affairs': '#f97316' };
        return colors[subject] || '#059669';
    }

    function getIconForSubject(subject) {
        const icons = { 'Tamil': 'TN', 'English': 'EN', 'Maths': 'MA', 'Reasoning': 'RS', 'History': 'HI', 'Polity': 'PO', 'Science': 'SC', 'Geography': 'GG', 'Current Affairs': 'CA' };
        return icons[subject] || 'DOC';
    }

    try {
        const snapshot = await db.collection('materials').orderBy('createdAt', 'desc').get();
        let materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fallback to mock data if empty
        if (materials.length === 0 && window.MOCK_DATA && MOCK_DATA.materials) {
            materials = MOCK_DATA.materials;
        }

        materials = materials.filter(m => {
            const matchesSearch = m.title && m.title.toLowerCase().includes(filterText.toLowerCase());
            if (!matchesSearch) return false;

            if (filterCat === 'all') return true;
            return m.subject === filterCat;
        });

        if (materials.length === 0) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: rgba(255, 255, 255, 0.8);">No materials found for this filter.</div>';
            return;
        }

        container.innerHTML = ''; // Clear loading spinner

        // Use the existing grid layout
        const grid = document.createElement('div');
        grid.className = 'grid-3';

        materials.forEach((material, index) => {
            const requiredPlan = normalizePlanId(material.requiredPlan || 'free');
            const isLockedPlan = requiredPlan !== 'free';
            const targetUrl = String(material.pdfUrl || '#');
            const safeTargetUrl = targetUrl.replace(/'/g, "\\'");

            const card = document.createElement('div');
            card.className = 'mock-card';
            card.style.animationDelay = `${0.1 + (index * 0.1)}s`;
            if (isLockedPlan) {
                card.style.border = '1px solid rgba(16, 185, 129, 0.35)';
                card.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.12)';
            }

            const accessTag = isLockedPlan
                ? `<div class="mock-category-tag" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35);">${requiredPlan.toUpperCase()}+</div>`
                : '<div class="mock-category-tag" style="background: rgba(148, 163, 184, 0.2); color: #64748b; border: 1px solid rgba(148, 163, 184, 0.25);">FREE</div>';
            const viewAction = isLockedPlan
                ? `href="#" onclick="return handlePlanLockedAsset(event, '${safeTargetUrl}', '${requiredPlan}', 'material')"`
                : `href="${targetUrl}" target="_blank"`;
            const downloadAction = isLockedPlan
                ? `href="#" onclick="return handlePlanLockedAsset(event, '${safeTargetUrl}', '${requiredPlan}', 'material')"`
                : `href="${targetUrl}" target="_blank" download`;

            card.innerHTML = `
                ${accessTag}
                <div class="mock-icon-wrap" style="background: ${getColorForSubject(material.subject)}; color: white;">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <h3 class="mock-title">${material.title}</h3>
                <div class="mock-meta" style="margin-bottom: 8px;">
                    <div class="meta-item"><i class="fas fa-bookmark"></i> <span>${material.subject || 'General'}</span></div>
                    <div class="meta-item"><i class="fas fa-layer-group"></i> <span>${material.category || 'Notes'}</span></div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; font-weight: 600;">
                    <span><i class="fas fa-star" style="color: #f59e0b; margin-right: 4px;"></i> 5.0 Rating</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: auto;">
                    <a ${viewAction} class="mock-start-btn" style="padding: 12px; font-size: 0.9rem;">
                        <i class="fas fa-eye"></i> <span>View</span>
                    </a>
                    <a ${downloadAction} class="mock-start-btn" style="padding: 12px; font-size: 0.9rem;">
                        <i class="fas fa-download"></i> <span>PDF</span>
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });

        container.appendChild(grid);

    } catch (error) {
        console.error("Error fetching materials:", error);
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: rgba(255, 255, 255, 0.8);">Failed to load materials. Please try again later.</div>';
    }
}

// ==========================================
// HOME PAGE: DYNAMIC EXAM CATEGORIES
// ==========================================
async function fetchAndRenderExamCategories() {
    const container = document.getElementById('exam-categories-container');
    if (!container) return;

    let categories = [];
    try {
        const snap = await db.collection('subjects').get();
        snap.forEach(doc => {
            const d = doc.data();
            const categoryName = d.name || d.category || 'Unknown';
            categories.push({
                name: categoryName,
                shortCode: (categoryName || 'XX').substring(0, 2).toUpperCase(),
                color: d.color || '#059669',
                bg: d.bg || 'var(--primary-light)',
                link: `${getPath('exams-hub.html')}?subject=${encodeURIComponent(doc.id)}&cat=${encodeURIComponent(categoryName)}`
            });
        });
    } catch (e) { console.warn('ExamCategories fetch error:', e); }

    if (categories.length === 0 && window.MOCK_DATA) {
        categories = (MOCK_DATA.examCategories || []).map(cat => ({
            ...cat,
            link: `${getPath('exams-hub.html')}?cat=${encodeURIComponent(cat.name || '')}`
        }));
    }

    container.innerHTML = categories.map((cat, i) => `
        <a href="${cat.link}" class="exam-cat-card glass hover-3d fade-in"
            style="animation-delay: ${i * 0.1}s;">
            <div class="cat-icon-sm" style="background: ${cat.bg}; color: ${cat.color};">${cat.shortCode}</div>
            <span class="cat-name">${cat.name}</span>
        </a>
    `).join('');
}

// ==========================================
// HOME PAGE: CURRENT AFFAIRS HIGHLIGHTS
// ==========================================
async function fetchAndRenderCurrentAffairs() {
    const container = document.getElementById('ca-highlights-container');
    if (!container) return;

    const allowedTypes = new Set(['daily_ca', 'weekly_ca', 'monthly_ca']);
    let items = [];
    try {
        const snap = await db
            .collection('materials')
            .where('assetType', 'in', ['daily_ca', 'weekly_ca', 'monthly_ca'])
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();
        snap.forEach(doc => items.push(doc.data().title || 'Current Affairs Update'));
    } catch (e) {
        if (e && (e.code === 'failed-precondition' || String(e.message || '').toLowerCase().includes('requires an index'))) {
            try {
                const fallbackSnap = await db.collection('materials').orderBy('createdAt', 'desc').limit(30).get();
                fallbackSnap.forEach(doc => {
                    const d = doc.data() || {};
                    if (allowedTypes.has(String(d.assetType || '').toLowerCase())) {
                        items.push(d.title || 'Current Affairs Update');
                    }
                });
                items = items.slice(0, 3);
            } catch (fallbackError) {
                console.warn('CA highlights fallback fetch error:', fallbackError);
            }
        } else {
            console.warn('CA highlights fetch error:', e);
        }
    }

    if (items.length === 0 && window.MOCK_DATA) items = MOCK_DATA.currentAffairs;

    container.innerHTML = items.map(item => `
        <li class="ca-list-item">
            <span>${item}</span>
        </li>
    `).join('');
}

// ==========================================
// HOME PAGE: FREE MOCK TESTS
// ==========================================
async function fetchAndRenderFreeMocks() {
    const container = document.getElementById('free-mocks-container');
    if (!container) return;

    let tests = [];
    try {
        const snap = await db.collection('tests').orderBy('createdAt', 'desc').limit(30).get();
        snap.forEach(doc => {
            const d = doc.data();
            const requiredPlan = normalizePlanId(d.requiredPlan || 'free');
            if (requiredPlan !== 'free') return;
            tests.push({
                title: d.title || 'Mock Test',
                category: d.examType || d.category || 'General',
                questions: d.questions || 100,
                duration: d.duration || 90,
                shortCode: (d.examType || 'MT').substring(0, 2).toUpperCase(),
                color: '#059669',
                bg: 'var(--primary-light)'
            });
        });
        tests = tests.slice(0, 3);
    } catch (e) { console.warn('FreeMocks fetch error:', e); }

    if (tests.length === 0 && window.MOCK_DATA) tests = MOCK_DATA.freeMockTests;

    const colors = [
        { color: '#3b82f6', bg: '#eff6ff' },
        { color: '#059669', bg: 'var(--primary-light)' },
        { color: '#16a34a', bg: '#f0fdf4' }
    ];

    container.innerHTML = tests.map((t, i) => {
        const c = colors[i % colors.length];
        return `
        <a href="${getPath('mock-tests.html')}" class="mock-card fade-in" style="animation-delay: ${i * 0.1}s;">
            <div class="card-icon" style="background: ${c.bg}; color: ${c.color};"><i class="fas fa-edit"></i></div>
            <div class="card-body">
                <span class="mock-badge" style="background: ${c.bg}; color: ${c.color};">${t.category}</span>
                <h4 class="mock-card-title">${t.title}</h4>
                <p class="mock-card-meta">${t.questions} Questions &bull; ${t.duration} Mins</p>
            </div>
        </a>`;
    }).join('');
}

// ==========================================
// HOME PAGE: POPULAR COURSES
// ==========================================
async function fetchAndRenderCourses() {
    const container = document.getElementById('courses-container');
    if (!container) return;

    let courses = [];
    try {
        const snap = await db.collection('courses').orderBy('createdAt', 'desc').limit(3).get();
        snap.forEach(doc => {
            const d = doc.data();
            courses.push({
                title: d.title || 'Course',
                tag: d.tag || 'COURSE',
                description: d.description || '',
                price: d.price || '0',
                period: d.period || 'Life',
                image: d.image || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=250&fit=crop'
            });
        });
    } catch (e) { console.warn('Courses fetch error:', e); }

    if (courses.length === 0 && window.MOCK_DATA) courses = MOCK_DATA.courses;

    container.innerHTML = courses.map((c, i) => `
        <div class="course-card fade-in" style="animation-delay: ${i * 0.1}s;">
            <div class="course-img">
                <img src="${c.image}" alt="${c.title}" loading="lazy">
                <span class="course-tag">${c.tag}</span>
            </div>
            <div class="course-content">
                <h3 class="course-card-title">${c.title}</h3>
                <p class="course-card-desc">${c.description}</p>
            </div>
        </div>
    `).join('');
}

// ==========================================
// HOME PAGE: SUCCESS STORIES / TESTIMONIALS
// ==========================================
async function fetchAndRenderTestimonials() {
    const container = document.getElementById('testimonials-container');
    if (!container) return;

    let testimonials = [];
    try {
        const snap = await db.collection('testimonials').orderBy('createdAt', 'desc').limit(3).get();
        snap.forEach(doc => {
            const d = doc.data();
            testimonials.push({
                text: d.text || '',
                name: d.name || 'Student',
                achievement: d.achievement || '',
                initial: (d.name || 'S')[0],
                color: d.color || 'var(--primary)',
                bg: d.bg || 'var(--primary-light)',
                borderColor: d.borderColor || 'var(--primary)'
            });
        });
    } catch (e) { console.warn('Testimonials fetch error:', e); }

    if (testimonials.length === 0 && window.MOCK_DATA) testimonials = MOCK_DATA.testimonials;

    container.innerHTML = testimonials.map((t, i) => `
        <div class="testimonial-card fade-in"
            style="animation-delay: ${i * 0.1}s; background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 32px; border-left: 8px solid ${t.borderColor}; box-shadow: var(--shadow-soft);">
            <p style="font-style: italic; color: var(--secondary); opacity: 0.8; font-size: 1.1rem; line-height: 1.7; margin-bottom: 24px;">"${t.text}"</p>
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 50px; height: 50px; background: ${t.bg}; color: ${t.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800;">${t.initial}</div>
                <div>
                    <h4 style="font-weight: 800; color: var(--secondary);">${t.name}</h4>
                    <p style="font-size: 0.85rem; color: ${t.color}; font-weight: 700;">${t.achievement}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// CURRENT AFFAIRS PAGE: DYNAMIC PDF CARDS
// ==========================================
async function fetchAndRenderCAPDFs(filterCategory = 'all') {
    const container = document.getElementById('ca-pdf-container');
    if (!container) return;

    let pdfs = [];
    try {
        let query = db.collection('materials').orderBy('createdAt', 'desc');
        if (filterCategory !== 'all') {
            const typeMap = { 'daily': 'daily_ca', 'weekly': 'weekly_ca', 'monthly': 'monthly_ca', 'yearly': 'gk_static' };
            const assetType = typeMap[filterCategory] || filterCategory;
            query = db.collection('materials').where('assetType', '==', assetType).orderBy('createdAt', 'desc');
        } else {
            query = db.collection('materials').where('assetType', 'in', ['daily_ca', 'weekly_ca', 'monthly_ca', 'gk_static']).orderBy('createdAt', 'desc');
        }
        const snap = await query.limit(9).get();
        snap.forEach(doc => {
            const d = doc.data();
            pdfs.push({
                title: d.title || 'Document',
                description: d.subject || 'Current Affairs',
                category: (d.assetType || 'daily').replace('_ca', ''),
                url: d.pdfUrl || '#'
            });
        });
    } catch (e) { console.warn('CA PDFs fetch error:', e); }

    if (pdfs.length === 0 && window.MOCK_DATA) {
        pdfs = filterCategory === 'all'
            ? MOCK_DATA.currentAffairsPDFs
            : MOCK_DATA.currentAffairsPDFs.filter(p => p.category === filterCategory);
    }

    if (pdfs.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;"><h3 style="color: rgba(255, 255, 255, 0.8);">No documents found for this category.</h3></div>';
        return;
    }

    const iconMap = {
        'daily': 'fas fa-newspaper',
        'weekly': 'fas fa-book-open',
        'monthly': 'fas fa-book',
        'gk_static': 'fas fa-university',
        'gk': 'fas fa-university'
    };

    container.innerHTML = '';

    pdfs.forEach((p, index) => {
        const iconClass = iconMap[p.category] || 'fas fa-file-alt';
        const card = document.createElement('div');
        card.className = 'ca-card';
        card.style.animationDelay = `${0.1 + (index * 0.1)}s`;

        card.innerHTML = `
            <div class="ca-icon-box">
                <i class="${iconClass}"></i>
            </div>
            <h3 class="ca-title">${p.title}</h3>
            <div class="ca-meta">
                <span class="ca-tag">${p.category.toUpperCase()} UPDATE</span>
                <span><i class="fas fa-clock"></i> New</span>
            </div>
            <a href="${p.url}" class="ca-download-btn" ${p.url.startsWith('http') ? 'target="_blank"' : ''}>
                <span>Download PDF</span>
                <i class="fas fa-arrow-right"></i>
            </a>
        `;
        container.appendChild(card);
    });
}

window.fetchAndRenderCAPDFs = fetchAndRenderCAPDFs;

// ==========================================
// LIVE UPDATES TICKER (Dynamic from Firebase)
// ==========================================
function parseBroadcastEnabled(value, fallback = true) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) return false;
        if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) return true;
    }
    return fallback;
}

async function getBroadcastEnabled() {
    // Primary source for learner-facing config (matches siteConfig usage in homepage).
    try {
        const siteDoc = await db.collection('siteConfig').doc('broadcast').get();
        if (siteDoc.exists) {
            return parseBroadcastEnabled(siteDoc.data() && siteDoc.data().enabled, true);
        }
    } catch (e) {
        console.warn('Broadcast siteConfig read failed:', e);
    }

    // Backward compatibility with previous settings path.
    try {
        const settingsDoc = await db.collection('settings').doc('broadcastEnabled').get();
        if (settingsDoc.exists) {
            return parseBroadcastEnabled(settingsDoc.data() && settingsDoc.data().enabled, true);
        }
    } catch (e) {
        console.warn('Broadcast settings read failed:', e);
    }

    return true;
}

function applyTickerVisibility(enabled, container) {
    const tickerWrap = container
        ? container.closest('.ticker-wrap')
        : document.querySelector('.ticker-wrap');
    if (tickerWrap) tickerWrap.style.display = enabled ? '' : 'none';
    if (document.documentElement) {
        document.documentElement.classList.toggle('ticker-hidden', !enabled);
    }
    if (document.body) {
        document.body.classList.toggle('ticker-hidden', !enabled);
    }
}

async function fetchAndRenderTicker() {
    const container = document.getElementById('alert-ticker');
    if (!container) return;

    let items = [];
    try {
        const broadcastEnabled = await getBroadcastEnabled();
        if (!broadcastEnabled) {
            applyTickerVisibility(false, container);
            container.innerHTML = '';
            return;
        }
        applyTickerVisibility(true, container);

        const snap = await db.collection('ticker').orderBy('createdAt', 'desc').get();
        snap.forEach(doc => {
            const d = doc.data();
            items.push({ badge: d.badge || 'UPDATE', text: d.text || '' });
        });
    } catch (e) { console.warn('Ticker fetch error:', e); }

    if (items.length === 0 && window.MOCK_DATA) items = MOCK_DATA.tickerItems;

    // Build ticker HTML with duplicates for seamless loop
    const html = items.map(i => `<div class="ticker-item"><span>${i.badge}</span> ${i.text}</div>`).join('');
    container.innerHTML = html + html; // duplicate for seamless CSS marquee
}

let tickerBroadcastWatcherAttached = false;
function watchBroadcastTickerSetting() {
    if (tickerBroadcastWatcherAttached) return;
    const container = document.getElementById('alert-ticker');
    if (!container) return;

    tickerBroadcastWatcherAttached = true;
    try {
        db.collection('siteConfig').doc('broadcast').onSnapshot((doc) => {
            const enabled = doc.exists
                ? parseBroadcastEnabled(doc.data() && doc.data().enabled, true)
                : true;
            applyTickerVisibility(enabled, container);
            if (!enabled) {
                container.innerHTML = '';
                return;
            }
            fetchAndRenderTicker();
        }, (error) => {
            console.warn('Broadcast watcher error:', error);
        });
    } catch (e) {
        console.warn('Unable to attach broadcast watcher:', e);
    }
}

window.fetchAndRenderTicker = fetchAndRenderTicker;

// ==========================================
// RAZORPAY PAYMENT FLOW (Firebase Functions)
// ==========================================
const RAZORPAY_FUNCTION_REGION = 'asia-south1';
const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise = null;
let paymentInProgress = false;

function getFunctionsBaseUrl() {
    const projectId = (firebase.app && firebase.app().options && firebase.app().options.projectId)
        ? firebase.app().options.projectId
        : 'nellailearningacademy';
    return `https://${RAZORPAY_FUNCTION_REGION}-${projectId}.cloudfunctions.net`;
}

function parseApiError(rawBody, fallbackMessage) {
    if (!rawBody) return fallbackMessage;
    try {
        const parsed = JSON.parse(rawBody);
        return parsed.error || parsed.message || fallbackMessage;
    } catch (_) {
        return fallbackMessage;
    }
}

async function postToFunctions(path, payload) {
    const endpoint = `${getFunctionsBaseUrl()}/${path}`;
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });
    } catch (_) {
        throw new Error('Unable to reach payment server. Check internet and function URL.');
    }
    const raw = await response.text();
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Payment API not deployed. Deploy Firebase functions first.');
        }
        throw new Error(parseApiError(raw, `Request failed (${response.status})`));
    }
    try {
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        throw new Error('Invalid server response.');
    }
}

function ensureRazorpayCheckoutLoaded() {
    if (window.Razorpay) return Promise.resolve();
    if (razorpayScriptPromise) return razorpayScriptPromise;

    razorpayScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = RAZORPAY_CHECKOUT_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Unable to load Razorpay checkout script.'));
        document.head.appendChild(script);
    });

    return razorpayScriptPromise;
}

async function getPlanForPayment(planId) {
    const normalizedPlanId = normalizePlanId(planId);
    if (!normalizedPlanId || normalizedPlanId === 'free') return null;

    try {
        const doc = await db.collection('plans').doc(normalizedPlanId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
    } catch (e) {
        console.warn('Plan fetch failed from Firestore doc lookup:', e);
    }

    const cached = (window.plansData || []).find(p => normalizePlanId(p.id) === normalizedPlanId);
    if (cached) return cached;
    return null;
}

window.processMockPayment = async (planId) => {
    const selectedPlanId = normalizePlanId(planId);

    if (!selectedPlanId) {
        alert('Invalid plan selected.');
        return;
    }

    if (selectedPlanId === 'free') {
        alert('You are already on the Free plan.');
        return;
    }

    if (paymentInProgress) {
        alert('A payment is already in progress. Please complete it first.');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('Please login first to upgrade your plan.');
        toggleModal('login-modal');
        return;
    }

    const currentPlanId = await getCurrentUserPlanId();
    const normalizedCurrentPlanId = normalizePlanId(currentPlanId || 'free');
    if (normalizedCurrentPlanId === selectedPlanId) {
        alert(`You are already subscribed to the ${selectedPlanId.toUpperCase()} plan.`);
        return;
    }

    const rankMap = await getPlanRankMap();
    const selectedRank = getPlanRank(rankMap, selectedPlanId);
    const currentRank = getPlanRank(rankMap, normalizedCurrentPlanId);
    const selectedRankKnown = Object.prototype.hasOwnProperty.call(rankMap, selectedPlanId);
    const currentRankKnown = Object.prototype.hasOwnProperty.call(rankMap, normalizedCurrentPlanId);
    if (selectedRankKnown && currentRankKnown && selectedRank <= currentRank) {
        alert('Your current plan already covers this tier.');
        return;
    }

    const plan = await getPlanForPayment(selectedPlanId);
    if (!plan) {
        alert('Selected plan details were not found. Please refresh and try again.');
        return;
    }

    const amountValue = parsePlanPriceValue(plan.price);
    if (!Number.isFinite(amountValue) || amountValue <= 0 || amountValue === Number.POSITIVE_INFINITY) {
        alert('Plan amount is invalid. Please contact support.');
        return;
    }

    paymentInProgress = true;

    try {
        const idToken = await user.getIdToken(true);
        const orderResponse = await postToFunctions('createRazorpayOrder', {
            idToken,
            planId: selectedPlanId
        });

        if (!orderResponse || !orderResponse.orderId || !orderResponse.keyId) {
            throw new Error('Unable to create Razorpay order.');
        }

        await ensureRazorpayCheckoutLoaded();

        const options = {
            key: orderResponse.keyId,
            amount: orderResponse.amount,
            currency: orderResponse.currency || 'INR',
            name: 'Gov Learn',
            description: `${orderResponse.planName || (plan.name || selectedPlanId.toUpperCase())} Subscription`,
            order_id: orderResponse.orderId,
            prefill: {
                name: user.displayName || '',
                email: user.email || ''
            },
            notes: {
                plan_id: selectedPlanId,
                user_uid: user.uid
            },
            theme: { color: '#059669' },
            modal: {
                ondismiss: () => {
                    paymentInProgress = false;
                }
            },
            handler: async (razorpayResponse) => {
                try {
                    const verifyPayload = {
                        idToken,
                        planId: selectedPlanId,
                        razorpayOrderId: razorpayResponse.razorpay_order_id,
                        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
                        razorpaySignature: razorpayResponse.razorpay_signature
                    };
                    const verifyResponse = await postToFunctions('verifyRazorpayPayment', verifyPayload);
                    if (!verifyResponse || !verifyResponse.ok) {
                        throw new Error((verifyResponse && verifyResponse.error) || 'Payment verification failed.');
                    }

                    alert(`Payment successful! Your plan is now ${selectedPlanId.toUpperCase()}.`);
                    window.location.reload();
                } catch (verifyError) {
                    console.error('Payment verification error:', verifyError);
                    alert(`Payment captured but verification failed.\n${verifyError.message}`);
                } finally {
                    paymentInProgress = false;
                }
            }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', (response) => {
            const message = response && response.error && response.error.description
                ? response.error.description
                : 'Payment failed. Please try again.';
            alert(message);
            paymentInProgress = false;
        });
        razorpay.open();
    } catch (error) {
        console.error('Razorpay payment initiation failed:', error);
        alert(`Payment could not be started.\n${error.message}`);
        paymentInProgress = false;
    }
};

// Function to fetch and render subscription plans
async function fetchAndRenderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    try {
        const snapshot = await db.collection('plans').get();
        let plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        plans.sort((a, b) => {
            const aPrice = parsePlanPriceValue(a.price);
            const bPrice = parsePlanPriceValue(b.price);
            if (aPrice !== bPrice) return aPrice - bPrice;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });

        // Fallback to mock data if empty
        if (plans.length === 0 && window.MOCK_DATA && MOCK_DATA.plans) {
            plans = MOCK_DATA.plans;
        }

        if (plans.length > 0) {
            const currentPlanId = normalizePlanId(await getCurrentUserPlanId() || 'free');
            const rankMap = await getPlanRankMap();
            const currentPlanRank = getPlanRank(rankMap, currentPlanId);
            container.innerHTML = '';
            plans.forEach(plan => {
                const card = document.createElement('div');
                card.className = `pricing-card ${plan.popular ? 'popular fade-in' : ''}`;

                let featuresHtml = '';
                if (plan.features && Array.isArray(plan.features)) {
                    featuresHtml = plan.features.map(f => `<li>${f}</li>`).join('');
                }

                const pColor = plan.color || '';
                const popularBadgeStyle = pColor ? `style="background: ${pColor}"` : '';
                const normalizedPlanId = normalizePlanId(plan.id);
                const planRank = getPlanRank(rankMap, normalizedPlanId);
                const isCurrentPlan = normalizedPlanId === currentPlanId;
                const isIncludedInCurrentPlan = !isCurrentPlan && currentPlanId !== 'free' && planRank < currentPlanRank;
                const isActionDisabled = isCurrentPlan || isIncludedInCurrentPlan;
                const buttonLabel = isCurrentPlan
                    ? 'Current Plan'
                    : isIncludedInCurrentPlan
                        ? 'Included in Your Plan'
                        : (plan.buttonText || 'Get Started');
                const safePlanId = String(plan.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const buttonAction = isActionDisabled ? '' : `onclick=\"processMockPayment('${safePlanId}')\"`;

                card.innerHTML = `
                    ${plan.popular ? `<div class="popular-badge" ${popularBadgeStyle}>${plan.badge || 'MOST VALUE'}</div>` : ''}
                    <h3 style="${pColor ? `color: ${pColor}` : ''}">${plan.name}</h3>
                    <div class="price" style="${pColor ? `color: ${pColor}` : ''}">&#8377;${plan.price}<span>${plan.period}</span></div>
                    <ul class="features-list">
                        ${featuresHtml}
                    </ul>
                    <button type="button" class="btn-primary" style="width: 100%; ${isActionDisabled ? 'opacity:0.85; cursor:not-allowed;' : ''}"
                        ${isActionDisabled ? 'disabled aria-disabled="true"' : buttonAction}>${buttonLabel}</button>
                `;
                container.appendChild(card);
            });
        }
    } catch (e) {
        console.error("Error fetching plans:", e);
    }
}

// Call all render functions when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    fetchAndApplySEO();
    fetchAndRenderVideos();
    fetchAndRenderMaterials();
    fetchAndRenderExamCategories();
    fetchAndRenderCurrentAffairs();
    fetchAndRenderFreeMocks();
    fetchAndRenderCourses();
    fetchAndRenderTestimonials();
    fetchAndRenderTicker();
    watchBroadcastTickerSetting();
    fetchAndRenderCAPDFs();
    fetchAndRenderPlans();
});
