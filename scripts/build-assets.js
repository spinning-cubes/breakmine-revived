import fs from 'node:fs';
import path from 'node:path';

const RESOURCES_DIR = path.resolve('src/resources');
const OUTPUT_FILE = path.resolve('src/resources.js');

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
};

function walkDir(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkDir(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const allFiles = walkDir(RESOURCES_DIR);
const assetMap = {};

for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME_TYPES[ext]) continue;

    // Relativize path to match the game's texture keys (e.g., "gui/font.png")
    const relativePath = path.relative(RESOURCES_DIR, filePath).replace(/\\/g, '/');
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    
    assetMap[relativePath] = `data:${MIME_TYPES[ext]};base64,${base64}`;
}

const fileContent = `// Auto-generated Base64 assets\nexport const base64Assets = ${JSON.stringify(assetMap, null, 2)};\n`;
fs.writeFileSync(OUTPUT_FILE, fileContent);

console.log(`Successfully converted ${Object.keys(assetMap).length} images to Base64 in src/resources.js`);