/**
 * Admin SEO Configuration Module
 * Include this script in your admin panel to enable SEO settings management.
 * Usage: <div id="admin-seo-container"></div>
 *        <script src="js/admin-seo.js"></script>
 *        <script>window.initAdminSEO('admin-seo-container');</script>
 */

window.initAdminSEO = async (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`SEO Admin Container #${containerId} not found.`);
        return;
    }

    // Fix: Force "NELLAI" logo text to be white in Admin Panel (overrides light-mode black)
    const styleFix = document.createElement('style');
    styleFix.innerHTML = `
        .logo-main, .light-mode .logo-main { color: #ffffff !important; }
    `;
    document.head.appendChild(styleFix);

    // Render Form
    container.innerHTML = `
        <div class="seo-admin-panel glass-card fade-in" style="padding: 24px; border-radius: 12px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
                <div style="background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-search"></i>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem;">SEO Configuration</h3>
                    <p style="margin: 0; font-size: 0.9rem; opacity: 0.7;">Manage search engine visibility and meta tags</p>
                </div>
            </div>

            <form id="seo-config-form" style="display: grid; gap: 20px;">
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Site Name (Title Suffix)</label>
                    <input type="text" id="seo-site-name" class="form-control" placeholder="e.g. Gov Learn Academy" 
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                    <small style="opacity: 0.6; display: block; margin-top: 4px;">Appended to page titles (e.g. "Home | Gov Learn Academy")</small>
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Meta Keywords</label>
                    <textarea id="seo-keywords" class="form-control" rows="3" placeholder="e.g. tnpsc, ssc, banking, government exams, online courses"
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;"></textarea>
                    <small style="opacity: 0.6; display: block; margin-top: 4px;">Comma-separated keywords for search engines.</small>
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Meta Description</label>
                    <textarea id="seo-description" class="form-control" rows="3" placeholder="A brief summary of your website content..."
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;"></textarea>
                    <small style="opacity: 0.6; display: block; margin-top: 4px;">Shown in search engine results (150-160 characters recommended).</small>
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Author / Organization</label>
                    <input type="text" id="seo-author" class="form-control" placeholder="e.g. Nellai Learning Academy"
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                    <button type="submit" class="btn-primary" style="padding: 10px 24px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-save"></i> Save SEO Settings
                    </button>
                </div>
            </form>
        </div>
    `;

    // Load existing settings
    try {
        const doc = await db.collection('siteConfig').doc('seo').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.siteName) document.getElementById('seo-site-name').value = data.siteName;
            if (data.keywords) document.getElementById('seo-keywords').value = data.keywords;
            if (data.description) document.getElementById('seo-description').value = data.description;
            if (data.author) document.getElementById('seo-author').value = data.author;
        }
    } catch (error) {
        console.error("Error loading SEO settings:", error);
    }

    // Handle Save
    document.getElementById('seo-config-form').onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const seoData = {
            siteName: document.getElementById('seo-site-name').value.trim(),
            keywords: document.getElementById('seo-keywords').value.trim(),
            description: document.getElementById('seo-description').value.trim(),
            author: document.getElementById('seo-author').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('siteConfig').doc('seo').set(seoData, { merge: true });
            alert('SEO configuration updated successfully!');
        } catch (error) {
            console.error("Error saving SEO settings:", error);
            alert('Failed to save settings. Check console for details.');
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    };
};