let subjects = [];
window.subjects = subjects;

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
        const navLinks = document.querySelector('.nav-links');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        if (navLinks && toggleBtn) {
            navLinks.classList.remove('active');
            toggleBtn.classList.remove('active');
        }
    }
}

function toggleNav() {
    const navLinks = document.querySelector('.nav-links');
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    if (navLinks && toggleBtn) {
        navLinks.classList.toggle('active');
        toggleBtn.classList.toggle('active');
    }
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
        const clickedLink = e.target.closest('.nav-links a') || e.target.closest('.nav-links button');
        if (clickedLink && navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            toggleBtn.classList.remove('active');
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


document.addEventListener('DOMContentLoaded', () => {
    injectSubjects();
});

// Admin Configuration
const ADMIN_EMAIL = 'admin@gmail.com'; // Change this to your actual email

// Auth State Handling
auth.onAuthStateChanged(async (user) => {
    const loginBtns = document.querySelectorAll('.login-toggle-btn');
    if (user) {
        // Save/Update user in Firestore
        try {
            const userRef = db.collection('students').doc(user.uid);
            const userSnap = await userRef.get();

            if (!userSnap.exists) {
                // Wait a bit to see if displayName appears (from signup)
                const finalName = user.displayName || 'Learner';
                await userRef.set({
                    name: finalName,
                    email: user.email,
                    plan: 'free',
                    enrolled: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await userRef.set({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
        } catch (e) {
            console.error("Error saving user:", e);
        }

        // Check if we're on profile.html
        const isProfilePage = window.location.pathname.includes('profile.html');

        // Update login buttons based on current page
        loginBtns.forEach(btn => {
            if (isProfilePage) {
                // On profile page, button shows Logout
                btn.textContent = 'Logout';
                btn.onclick = (e) => {
                    e.preventDefault();
                    logout();
                }
            } else {
                // On other pages, hide login button and add Profile + Logout
                btn.style.display = 'none';
                if (btn.parentElement && btn.parentElement.id === 'login-nav-item') {
                    btn.parentElement.style.display = 'none';
                }
            }
        });

        // Add Profile and Logout to nav if not already there
        const navLinks = document.querySelector('.nav-links');
        if (navLinks && !isProfilePage) {
            // Find the login button to insert before it
            const loginNavItem = document.getElementById('login-nav-item');

            if (!document.getElementById('profile-nav-link')) {
                const profileLi = document.createElement('li');
                profileLi.id = 'profile-nav-link';
                profileLi.innerHTML = `<a href="profile.html">Profile</a>`;
                if (loginNavItem) {
                    navLinks.insertBefore(profileLi, loginNavItem);
                } else {
                    navLinks.appendChild(profileLi);
                }
            }

            if (!document.getElementById('logout-btn')) {
                const logoutLi = document.createElement('li');
                logoutLi.id = 'logout-btn';
                logoutLi.innerHTML = `<button type="button" class="btn-primary" onclick="logout()" style="background: #ef4444;">Logout</button>`;
                navLinks.appendChild(logoutLi);
            }
        }

        // Check if user is admin to show admin features in profile
        if (user.email === ADMIN_EMAIL) {
            const adminDashboardLink = document.getElementById('admin-dashboard-link');
            if (adminDashboardLink) {
                adminDashboardLink.style.display = 'block';
            }
        }
        console.log("User is logged in:", user.email);
    } else {
        // Remove Profile & Logout links if present
        const profileLink = document.getElementById('profile-nav-link');
        const logoutLink = document.getElementById('logout-btn');
        if (profileLink) profileLink.remove();
        if (logoutLink) logoutLink.remove();

        // Show login button again
        loginBtns.forEach(btn => {
            btn.style.display = 'inline-block';
            if (btn.parentElement && btn.parentElement.id === 'login-nav-item') {
                btn.parentElement.style.display = '';
            }
            btn.textContent = 'Login';
            btn.onclick = (e) => {
                e.preventDefault();
                toggleModal('login-modal');
            }
        });

        // Allow public access to all pages - login only required for premium features
    }
});

window.googleSignIn = async () => {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        console.log("Logged in:", result.user);
        toggleModal('login-modal');
    } catch (error) {
        console.error("Auth error:", error);
        if (error.code === 'auth/operation-not-supported-in-this-environment') {
            alert("Security Error: Firebase Authentication requires a local server. \n\nPlease open this project using 'Live Server' in VS Code or any other local server.");
        } else if (error.code === 'auth/unauthorized-domain') {
            const currentDomain = window.location.hostname;
            alert(`Unauthorized Domain Error!\n\nThe domain '${currentDomain}' is not authorized in your Firebase Project.\n\nTO FIX THIS:\n1. Open your Firebase Console\n2. Go to Authentication -> Settings -> Authorized Domains\n3. Click 'Add Domain' and enter: ${currentDomain}`);
        } else {
            alert("Login failed: " + error.message);
        }
    }
};


window.emailSignIn = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        toggleModal('login-modal');
    } catch (error) {
        alert("Login failed: " + error.message);
    }
};

window.emailSignUp = async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    try {
        const result = await auth.createUserWithEmailAndPassword(email, pass);
        // Update profile with name
        await result.user.updateProfile({ displayName: name });

        // Explicitly create Firestore doc to avoid race condition with onAuthStateChanged
        await db.collection('students').doc(result.user.uid).set({
            name: name,
            email: email,
            plan: 'free',
            enrolled: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });

        toggleModal('signup-modal');
        location.reload(); // Refresh to ensure session and data are in sync
    } catch (error) {
        alert("Signup failed: " + error.message);
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
    if (signupForm) signupForm.onsubmit = emailSignUp;
});

// ==========================================
// DYNAMIC CONTENT RENDERING (Videos & Materials)
// ==========================================

async function fetchAndRenderVideos() {
    const container = document.getElementById('videos-container');
    if (!container) return; // Only run on videos.html

    try {
        const snapshot = await db.collection('videos').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">No videos currently available.</div>';
            return;
        }

        container.innerHTML = ''; // Clear loading spinner

        snapshot.forEach(doc => {
            const data = doc.data();
            const isPremium = data.videoType === 'premium';

            // Premium vs Free specific styling
            const externalStyles = isPremium ? 'border: 2px solid transparent; background: linear-gradient(white, white) padding-box, linear-gradient(135deg, var(--primary-light), var(--accent-teal)) border-box;' : '';
            const badgeType = isPremium ? '<span class="badge" style="background: linear-gradient(135deg, var(--primary-light), var(--accent-teal)); color: var(--primary-dark);">Premium</span>' : '<span class="badge" style="background: #f1f5f9; color: #64748b;">Free</span>';
            const actionBtn = isPremium ? `<a href="#" class="btn-primary" style="display: block; text-align: center; margin-top: 16px; background: linear-gradient(135deg, var(--primary-green), var(--accent-teal));" onclick="alert('Unlock with GovLearn Premium');">Unlock Video</a>` : `<a href="video-view.html" class="btn-primary" style="display: block; text-align: center; margin-top: 16px;">Watch Now</a>`;
            const premiumOverlay = isPremium ? `<div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); padding: 4px 12px; border-radius: 20px; color: gold; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">⭐ PRO</div>` : '';

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
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #ef4444;">Failed to load videos. Please try again later.</div>';
    }
}

async function fetchAndRenderMaterials(filterText = '', filterCat = 'all') {
    const container = document.getElementById('materials-container');
    if (!container) return; // Only run on materials.html

    function getColorForSubject(subject) {
        const colors = { 'Tamil': '#059669', 'English': '#3b82f6', 'Maths': '#f59e0b', 'Reasoning': '#8b5cf6', 'History': '#ec4899', 'Polity': '#06b6d4', 'Science': '#10b981', 'Geography': '#6366f1', 'Current Affairs': '#ef4444' };
        return colors[subject] || '#059669';
    }

    function getIconForSubject(subject) {
        const icons = { 'Tamil': 'TN', 'English': 'EN', 'Maths': 'MA', 'Reasoning': 'RS', 'History': 'HI', 'Polity': 'PO', 'Science': 'SC', 'Geography': 'GG', 'Current Affairs': 'CA' };
        return icons[subject] || 'DOC';
    }

    try {
        const snapshot = await db.collection('materials').orderBy('createdAt', 'desc').get();
        let materials = snapshot.docs.map(doc => doc.data());

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
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">No materials found for this filter.</div>';
            return;
        }

        container.innerHTML = ''; // Clear loading spinner

        // Use the existing grid layout
        const grid = document.createElement('div');
        grid.className = 'grid-3';

        materials.forEach(material => {
            const isPremium = false;

            const card = document.createElement('div');
            card.className = 'card glass hover-3d fade-in';
            card.style.position = 'relative';

            const premiumTag = isPremium ? '<div style="position: absolute; top: 16px; right: 16px; background: #fef08a; color: #a16207; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(161, 98, 7, 0.2);">PREMIUM</div>' : '';

            card.innerHTML = `
                ${premiumTag}
                <div class="card-icon" style="background: ${getColorForSubject(material.subject)}; color: white; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; width:64px; height:64px; border-radius:16px; margin-bottom:20px;">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 8px;">${material.title}</h3>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 0.9rem;">
                    <span style="background: var(--primary-light); color: var(--primary-green); padding: 4px 10px; border-radius: 6px; font-weight: 600;">${material.subject || 'General'}</span>
                    <span style="color: var(--text-muted); font-weight: 600;">${material.category || 'Notes'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 16px; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">
                    <span><i class="fas fa-star" style="color: #f59e0b; margin-right: 4px;"></i> 5.0</span>
                    <span><i class="fas fa-clock" style="margin-right: 4px;"></i> Recent</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <a href="${material.pdfUrl || '#'}" target="_blank" class="btn-primary" style="padding: 12px; font-size: 0.85rem; text-align: center;"><i class="fas fa-download"></i> PDF</a>
                    <a href="${material.pdfUrl || '#'}" target="_blank" class="btn-primary" style="padding: 12px; font-size: 0.85rem; text-align: center; background: white; color: var(--primary-green); border: 2px solid var(--primary-light);"><i class="fas fa-eye"></i> View</a>
                </div>
            `;
            grid.appendChild(card);
        });

        container.appendChild(grid);

    } catch (error) {
        console.error("Error fetching materials:", error);
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #ef4444;">Failed to load materials. Please try again later.</div>';
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
            categories.push({
                name: d.name || d.category || 'Unknown',
                shortCode: (d.name || 'XX').substring(0, 2).toUpperCase(),
                color: d.color || '#059669',
                bg: d.bg || 'var(--primary-light)',
                link: `exams-hub.html?cat=${encodeURIComponent(d.name || d.category || '')}`
            });
        });
    } catch (e) { console.warn('ExamCategories fetch error:', e); }

    if (categories.length === 0 && window.MOCK_DATA) categories = MOCK_DATA.examCategories;

    container.innerHTML = categories.map((cat, i) => `
        <a href="${cat.link}" class="exam-cat-card glass hover-3d fade-in"
            style="background: white; padding: 32px 20px; border-radius: 24px; text-align: center; border: 1px solid rgba(0,0,0,0.05); text-decoration: none; transition: all 0.4s; animation-delay: ${i * 0.1}s;">
            <div style="background: ${cat.bg}; color: ${cat.color}; width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-weight: 800; font-size: 0.8rem;">${cat.shortCode}</div>
            <span style="font-weight: 800; color: var(--secondary);">${cat.name}</span>
        </a>
    `).join('');
}

// ==========================================
// HOME PAGE: CURRENT AFFAIRS HIGHLIGHTS
// ==========================================
async function fetchAndRenderCurrentAffairs() {
    const container = document.getElementById('ca-highlights-container');
    if (!container) return;

    let items = [];
    try {
        const snap = await db.collection('materials').where('assetType', 'in', ['daily_ca', 'weekly_ca', 'monthly_ca']).orderBy('createdAt', 'desc').limit(3).get();
        snap.forEach(doc => items.push(doc.data().title || 'Current Affairs Update'));
    } catch (e) { console.warn('CA highlights fetch error:', e); }

    if (items.length === 0 && window.MOCK_DATA) items = MOCK_DATA.currentAffairs;

    container.innerHTML = items.map(item => `
        <li style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px; font-weight: 500;">
            <i class="fas fa-check-circle" style="color: var(--primary-green);"></i> ${item}
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
        const snap = await db.collection('tests').orderBy('createdAt', 'desc').limit(3).get();
        snap.forEach(doc => {
            const d = doc.data();
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
        <a href="mock-tests.html" class="mock-card fade-in" style="animation-delay: ${i * 0.1}s;">
            <div class="card-icon" style="background: ${c.bg}; color: ${c.color};"><i class="fas fa-edit"></i></div>
            <div style="flex-grow: 1;">
                <span class="mock-badge" style="background: ${c.bg}; color: ${c.color};">${t.category}</span>
                <h4 style="margin: 8px 0; font-weight: 800;">${t.title}</h4>
                <p style="font-size: 0.85rem; opacity: 0.6; margin: 0;">${t.questions} Questions &bull; ${t.duration} Mins</p>
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
            </div>
            <div class="course-content">
                <span class="course-tag">${c.tag}</span>
                <h3 style="margin-bottom: 12px; font-weight: 800;">${c.title}</h3>
                <p style="font-size: 0.95rem; opacity: 0.7; margin-bottom: 24px;">${c.description}</p>
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
            style="animation-delay: ${i * 0.1}s; background: white; padding: 40px; border-radius: 32px; border-left: 8px solid ${t.borderColor}; box-shadow: var(--shadow-soft);">
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
        const snap = await query.limit(12).get();
        snap.forEach(doc => {
            const d = doc.data();
            pdfs.push({
                title: d.title || 'Document',
                description: d.subject || 'Current Affairs',
                category: d.assetType || 'daily',
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
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;"><h3 style="color: var(--text-muted);">No documents found for this category.</h3></div>';
        return;
    }

    const iconMap = {
        'daily_ca': 'fas fa-newspaper',
        'weekly_ca': 'fas fa-book-open',
        'monthly_ca': 'fas fa-book',
        'gk_static': 'fas fa-university',
        'daily': 'fas fa-newspaper',
        'weekly': 'fas fa-book-open',
        'monthly': 'fas fa-book',
        'yearly': 'fas fa-university'
    };

    container.innerHTML = pdfs.map(p => `
        <div class="pdf-card glass hover-3d">
            <div class="pdf-icon"><i class="${iconMap[p.category] || 'fas fa-file-alt'}"></i></div>
            <h3>${p.title}</h3>
            <p>${p.description}</p>
            <a href="${p.url}" class="btn-primary" ${p.url.startsWith('http') ? 'target="_blank"' : ''}>Download PDF</a>
        </div>
    `).join('');
}

window.fetchAndRenderCAPDFs = fetchAndRenderCAPDFs;

// ==========================================
// LIVE UPDATES TICKER (Dynamic from Firebase)
// ==========================================
async function fetchAndRenderTicker() {
    const container = document.getElementById('alert-ticker');
    if (!container) return;

    let items = [];
    try {
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

// Function to fetch and render subscription plans
async function fetchAndRenderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    try {
        const snapshot = await db.collection('plans').orderBy('price', 'asc').get();
        let plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fallback to mock data if empty
        if (plans.length === 0 && window.MOCK_DATA && MOCK_DATA.plans) {
            plans = MOCK_DATA.plans;
        }

        if (plans.length > 0) {
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

                card.innerHTML = `
                    ${plan.popular ? `<div class="popular-badge" ${popularBadgeStyle}>${plan.badge || 'MOST VALUE'}</div>` : ''}
                    <h3 style="${pColor ? `color: ${pColor}` : ''}">${plan.name}</h3>
                    <div class="price" style="${pColor ? `color: ${pColor}` : ''}">₹${plan.price}<span>${plan.period}</span></div>
                    <ul class="features-list">
                        ${featuresHtml}
                    </ul>
                    <button type="button" class="btn-primary" style="width: 100%;"
                        onclick="processMockPayment('${plan.id}')">${plan.buttonText || 'Get Started'}</button>
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
    fetchAndRenderVideos();
    fetchAndRenderMaterials();
    fetchAndRenderExamCategories();
    fetchAndRenderCurrentAffairs();
    fetchAndRenderFreeMocks();
    fetchAndRenderCourses();
    fetchAndRenderTestimonials();
    fetchAndRenderTicker();
    fetchAndRenderCAPDFs();
    fetchAndRenderPlans();
});
