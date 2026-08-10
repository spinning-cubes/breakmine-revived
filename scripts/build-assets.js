import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RESOURCES_DIR = path.resolve('src/resources');
const OUTPUT_FILE = path.resolve('src/resources.js');

const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg'
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
const hashToKey = {};
const aliases = [];
let dedupedCount = 0;
let dedupedBytes = 0;

for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME_TYPES[ext]) continue;

    // Relativize path to match the game's texture keys (e.g., "gui/font.png")
    const relativePath = path.relative(RESOURCES_DIR, filePath).replace(/\\/g, '/');

    // Texture-pack sound tree mirrors the vanilla sound/ folder but is unused
    // by the game; skip it to keep the bundle small.
    if (relativePath.startsWith('terrain/pack/sounds/')) continue;

    const fileBuffer = fs.readFileSync(filePath);

    // Deduplicate identical file contents: store the base64 once and
    // alias every duplicate key to the first occurrence. Identical files
    // are common (texture packs mirror the vanilla sound/music trees).
    const contentHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const firstKey = hashToKey[contentHash];
    if (firstKey) {
        aliases.push([relativePath, firstKey]);
        dedupedCount++;
        dedupedBytes += fileBuffer.length;
        continue;
    }
    hashToKey[contentHash] = relativePath;

    const base64 = fileBuffer.toString('base64');
    assetMap[relativePath] = `data:${MIME_TYPES[ext]};base64,${base64}`;
}

const aliasLines = aliases.map(([alias, target]) =>
    `base64Assets[${JSON.stringify(alias)}] = base64Assets[${JSON.stringify(target)}];`
);

const fileContent =
    `// Auto-generated Base64 assets\n` +
    `// Deduplicated: ${dedupedCount} assets share the same content and reference an existing copy.\n` +
    `export const base64Assets = ${JSON.stringify(assetMap, null, 2)};\n` +
    `\n` +
    aliasLines.join('\n') +
    `\n`;

fs.writeFileSync(OUTPUT_FILE, fileContent);

const totalKeys = Object.keys(assetMap).length + aliases.length;
console.log(`Converted ${totalKeys} assets to Base64 in src/resources.js`);
console.log(`Deduplicated ${dedupedCount} identical files (saved ${(dedupedBytes / 1048576).toFixed(1)} MB raw / ~${(dedupedBytes * 1.333 / 1048576).toFixed(1)} MB base64)`);
