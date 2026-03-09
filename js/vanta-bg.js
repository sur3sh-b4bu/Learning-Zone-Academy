/**
 * Background watermark handler.
 * Keeps watermark visual only and avoids forcing global section transparency.
 */

(function () {
    const WATERMARK_ID = 'bg-watermark';

    function shouldEnableWatermark() {
        const body = document.body;
        if (!body) return false;
        if (body.dataset.disableWatermark === 'true') return false;
        if (window.location.pathname.includes('/html/admin.html')) return false;
        return true;
    }

    function applyWatermarkTheme(watermark) {
        if (!watermark) return;
        const isLight = document.documentElement.classList.contains('light-mode');
        if (isLight) {
            watermark.style.opacity = '0.03';
            watermark.style.filter = 'grayscale(100%) invert(1) brightness(0.2)';
        } else {
            watermark.style.opacity = '0.04';
            watermark.style.filter = 'grayscale(100%) brightness(1.5)';
        }
    }

    function createBackgroundElements() {
        if (!shouldEnableWatermark()) return;
        if (document.getElementById(WATERMARK_ID)) return;

        const watermark = document.createElement('div');
        watermark.id = WATERMARK_ID;
        watermark.style.position = 'fixed';
        watermark.style.top = '0';
        watermark.style.left = '0';
        watermark.style.width = '100vw';
        watermark.style.height = '100vh';
        watermark.style.zIndex = '-1';
        watermark.style.backgroundImage = 'url("/logo1.png")';
        watermark.style.backgroundSize = window.innerWidth <= 768 ? '80% auto' : '80vh';
        watermark.style.backgroundPosition = 'center';
        watermark.style.backgroundRepeat = 'no-repeat';
        watermark.style.pointerEvents = 'none';

        applyWatermarkTheme(watermark);
        document.body.prepend(watermark);
        document.body.classList.add('bg-enhanced');

        const themeObserver = new MutationObserver(() => applyWatermarkTheme(watermark));
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        window.addEventListener('resize', () => {
            watermark.style.backgroundSize = window.innerWidth <= 768 ? '80% auto' : '80vh';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBackgroundElements);
    } else {
        createBackgroundElements();
    }
})();
