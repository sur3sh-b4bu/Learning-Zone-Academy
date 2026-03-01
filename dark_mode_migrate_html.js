const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Simple search and replace for hardcoded light backgrounds in inline styles
            const bgRegex = /(background(-color)?:\s*)(white|#ffffff|#fff|#f8fafc|#f1f5f9)/gi;
            if (bgRegex.test(content)) {
                content = content.replace(bgRegex, '$1rgba(255, 255, 255, 0.05)');
                modified = true;
            }

            // Simple search and replace for text colors
            const colorRegex = /(color:\s*)(#1e293b|#0f172a|#475569|#64748b|var\(--text-muted\))/gi;
            if (colorRegex.test(content)) {
                // Change to white/transparent white
                content = content.replace(colorRegex, '$1rgba(255, 255, 255, 0.8)');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated inline styles in ${file}`);
            }
        }
    }
}

const targetDirs = [
    path.join(__dirname, 'html'),
    path.join(__dirname, 'js'),
    __dirname // for index.html
];

targetDirs.forEach(d => {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
        try {
            processDir(d);
        } catch (e) { } // ignore if __dirname recursion hits something
    }
});
