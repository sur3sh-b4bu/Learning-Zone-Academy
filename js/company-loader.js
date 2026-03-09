/**
 * Company Pages Loader
 * Dynamically fetches and renders content for About, Contact, Vision, and Success Stories
 */

async function loadPageContent(pageId) {
    // Wait for Firebase to be initialized if needed
    if (typeof db === 'undefined') {
        console.warn('Firebase DB not initialized yet. Retrying...');
        setTimeout(() => loadPageContent(pageId), 500);
        return;
    }

    try {
        const doc = await db.collection('company_pages').doc(pageId).get();
        if (!doc.exists) {
            console.log(`No dynamic content found for ${pageId}, using defaults.`);
            return;
        }

        const data = doc.data();

        // Update fields with data-field attribute
        const fields = document.querySelectorAll('[data-field]');
        fields.forEach(field => {
            const key = field.getAttribute('data-field');
            if (data[key]) {
                if (field.tagName === 'IMG') {
                    field.src = data[key];
                } else if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                    field.value = data[key];
                } else {
                    field.innerHTML = data[key];
                }
            }
        });

        // Special handling for Success Stories (Testimonials Array)
        if (pageId === 'success_stories' && data.testimonials) {
            renderTestimonials(data.testimonials);
        }

        // Special handling for Contact Page (specific elements if not using data-field)
        if (pageId === 'contact') {
            const addressEl = document.querySelector('[data-field="address"]');
            if (addressEl && data.address) addressEl.innerHTML = data.address;

            const emailEl = document.querySelector('[data-field="email"]');
            if (emailEl && data.email) emailEl.textContent = data.email;

            const phoneEl = document.querySelector('[data-field="phone"]');
            if (phoneEl && data.phone) phoneEl.textContent = data.phone;
        }

    } catch (error) {
        console.error(`Error loading ${pageId} content:`, error);
    }
}

function renderTestimonials(testimonials) {
    const grid = document.querySelector('.success-grid');
    if (!grid) return;

    // Use existing structure but make it dynamic
    grid.innerHTML = testimonials.map((t, i) => `
        <div class="testimonial-card-premium glass fade-in" style="animation-delay: ${0.1 * (i + 1)}s;">
            <i class="fas fa-quote-right quote-icon"></i>
            <div class="student-info">
                <div class="student-avatar">${t.avatar_initials || (t.name ? t.name.charAt(0) : 'S')}</div>
                <div class="student-meta">
                    <h4>${t.name}</h4>
                    <p>${t.exam}</p>
                </div>
            </div>
            <p class="testimonial-text">"${t.text}"</p>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Determine page ID from filename
    const path = window.location.pathname;
    const filename = path.split('/').pop().split('?')[0];

    let pageId = '';
    if (filename === 'about.html') pageId = 'about';
    else if (filename === 'contact.html') pageId = 'contact';
    else if (filename === 'vision.html') pageId = 'vision';
    else if (filename === 'success-stories.html') pageId = 'success_stories';
    else if (filename === 'privacy.html') pageId = 'privacy';
    else if (filename === 'terms.html') pageId = 'terms';

    if (pageId) {
        // Tiny delay to ensure firebase script execution
        setTimeout(() => loadPageContent(pageId), 100);
    }
});
