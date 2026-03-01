/**
 * Components Loader
 * Handles dynamic injection of Navigation and Footer
 */

(function () {
    const isSubDir = window.location.pathname.includes('/html/');
    const base = isSubDir ? '../' : '';

    async function loadComponent(elementId, filePath) {
        const container = document.getElementById(elementId);
        if (!container) return;

        try {
            const response = await fetch(base + filePath);
            if (!response.ok) throw new Error(`Failed to load ${filePath}`);
            let html = await response.text();

            // Correct paths starting with '/' for GitHub Pages (avoids repo root mismatch)
            html = html.replace(/(href|src)="\/([^"]*)"/g, (match, attr, path) => {
                // Skip external links or already correct relative links
                if (path.startsWith('http') || path.startsWith('//') || path.startsWith('data:')) return match;
                // If link is just "/", result in base + index.html
                if (path === "") return `${attr}="${base}index.html"`;
                // Otherwise prepend base and use path (stripping the leading slash)
                return `${attr}="${base}${path}"`;
            });

            container.innerHTML = html;

            // Highlight active link
            const currentPath = window.location.pathname;
            const links = container.querySelectorAll('a');
            links.forEach(link => {
                const linkHref = link.getAttribute('href');
                if (linkHref && currentPath.endsWith(linkHref.split('/').pop())) {
                    link.classList.add('active');
                }
            });

            // Dispatch event to notify that nav is loaded
            if (elementId === 'main-nav') {
                const tickerWrap = container.querySelector('.ticker-wrap');
                if (tickerWrap) {
                    document.body.insertBefore(tickerWrap, document.body.firstChild);
                }

                window.dispatchEvent(new CustomEvent('navLoaded'));
                initScrollEffect();
                if (typeof window.fetchAndRenderTicker === 'function') {
                    window.fetchAndRenderTicker();
                }
            }
        } catch (error) {
            console.error('Error loading component:', error);
        }
    }

    function initScrollEffect() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        loadComponent('main-nav', 'components/navigation.html');
        loadComponent('main-footer', 'components/footer.html');
    });
})();
