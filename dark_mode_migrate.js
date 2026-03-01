const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'css');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));

for (const file of files) {
    if (file === 'navigation.css') continue; // keep navigation intact

    const filePath = path.join(cssDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace solid white backgrounds
    content = content.replace(/background:\s*(white|#ffffff|#fff);\s*/gi, 'background: var(--bg-glass);\n');
    content = content.replace(/background-color:\s*(white|#ffffff|#fff);\s*/gi, 'background: var(--bg-glass);\n');

    // Replace light grays
    content = content.replace(/background:\s*(#f1f5f9|#f8fafc|#f9fafb);\s*/gi, 'background: rgba(255, 255, 255, 0.03);\n');
    content = content.replace(/background-color:\s*(#f1f5f9|#f8fafc|#f9fafb);\s*/gi, 'background: rgba(255, 255, 255, 0.03);\n');

    // Replace card specific translucent whites
    content = content.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[789]\d*\);\s*/gi, 'background: rgba(255, 255, 255, 0.03);\n');

    // Soften borders
    content = content.replace(/border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.[5-9]\d*\);\s*/gi, 'border: 1px solid rgba(255, 255, 255, 0.08);\n');
    content = content.replace(/border:\s*1px\s*solid\s*(#e2e8f0|#cbd5e1);\s*/gi, 'border: 1px solid rgba(255, 255, 255, 0.1);\n');
    content = content.replace(/border-color:\s*(#e2e8f0|#cbd5e1);\s*/gi, 'border-color: rgba(255, 255, 255, 0.1);\n');
    content = content.replace(/border-bottom:\s*1px\s*solid\s*(#e2e8f0|#cbd5e1);\s*/gi, 'border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n');
    content = content.replace(/border-top:\s*1px\s*solid\s*(#e2e8f0|#cbd5e1);\s*/gi, 'border-top: 1px solid rgba(255, 255, 255, 0.1);\n');

    // Mute dark text colors since background is now dark
    content = content.replace(/color:\s*#1e293b;\s*/gi, 'color: var(--secondary);\n');
    content = content.replace(/color:\s*#0f172a;\s*/gi, 'color: var(--secondary);\n');
    content = content.replace(/color:\s*#475569;\s*/gi, 'color: rgba(255, 255, 255, 0.8);\n');
    content = content.replace(/color:\s*#64748b;\s*/gi, 'color: rgba(255, 255, 255, 0.8);\n');

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
}
