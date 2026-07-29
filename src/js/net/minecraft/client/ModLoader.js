import FileSystem from "./fs/Filesystem.js";

/**
 * ModLoader — discovers, installs, and registers mods.
 *
 * Supported mod layout (inside a ZIP or folder):
 *   ModData.js          — metadata (static NAME, ID, AUTHOR, VERSION)
 *   blocks/*.js          — block classes (extend Block)
 *   textures/*.png       — 16×16 block/item textures
 *
 * Block naming convention:
 *   BlockUnbreakableBlock  →  strip "Block"  →  UnbreakableBlock  →  unbreakable_block
 *   Final namespaced ID:  <modId>:unbreakable_block
 */
export default class ModLoader {
    /**
     * @param {import("./Minecraft.js").default} minecraft
     */
    constructor(minecraft) {
        this.minecraft = minecraft;
        this.mods = new Map();          // modId → ModEntry
        this.enabledMods = new Set();   // modIds that are active
        this.filesystem = new FileSystem('ModDB', 'mods');
        this._blockBaseClass = null;    // cached Block class for eval sandbox
    }

    /* ------------------------------------------------------------------
     *  Public API
     * ------------------------------------------------------------------ */

    /**
     * Load all installed mods from IndexedDB and register their content.
     * Call this once during game startup, after BlockRegistry.create().
     */
    async loadAllMods() {
        // Load enabled set from persistent settings
        this._loadEnabledSet();

        const modIds = await this.getInstalledModIds();
        console.log(`[ModLoader] Found ${modIds.length} installed mod(s)`);

        for (const modId of modIds) {
            if (!this.enabledMods.has(modId)) continue;
            try {
                await this._loadMod(modId);
            } catch (err) {
                console.error(`[ModLoader] Failed to load mod '${modId}':`, err);
            }
        }

        console.log(`[ModLoader] ${this.mods.size} mod(s) loaded successfully`);
    }

    /**
     * Install a mod from a ZIP File object (user-uploaded).
     * @param {File} zipFile
     * @returns {Promise<string>} the installed modId
     */
    async installModFromZip(zipFile) {
        const JSZip = await this._ensureJSZip();
        const zip = await JSZip.loadAsync(zipFile);

        // --- 1. Read ModData ---
        const modData = await this._readModDataFromZip(zip);
        const modId = modData.ID;

        // --- 2. Validate ---
        if (!modId || typeof modId !== 'string') {
            throw new Error('ModData.js must export a class with a static ID property.');
        }
        if (this.mods.has(modId)) {
            throw new Error(`A mod with ID '${modId}' is already loaded.`);
        }

        console.log(`[ModLoader] Installing mod '${modData.NAME}' (${modId}) v${modData.VERSION}`);

        // --- 3. Store mod metadata ---
        await this.filesystem.saveFile(JSON.stringify(modData), `mods/${modId}/ModData.json`);

        // --- 4. Extract block JS files ---
        for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (path.startsWith('blocks/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/blocks/${filename}`);
            }
        }

        // --- 5. Extract textures as base64 ---
        for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (path.startsWith('textures/') && path.endsWith('.png')) {
                const b64 = await entry.async('base64');
                const filename = path.split('/').pop();
                await this.filesystem.saveBinaryFile(b64, `mods/${modId}/textures/${filename}.b64`);
            }
        }

        // --- 6. Enable & load ---
        this.enabledMods.add(modId);
        this._saveEnabledSet();
        await this._loadMod(modId);

        return modId;
    }

    /**
     * Load a mod from a folder of pre-extracted files (dev mode).
     * @param {string} modId
     * @param {object} fileMap — { relativePath: stringContent | ArrayBuffer }
     */
    async loadModFromFolder(modId, fileMap) {
        console.log(`[ModLoader] Loading mod from folder: ${modId}`);

        // Store all files
        for (const [path, content] of Object.entries(fileMap)) {
            const fullPath = `mods/${modId}/${path}`;
            if (content instanceof ArrayBuffer || content instanceof Blob) {
                // Convert to base64 for binary storage
                const b64 = await this._arrayBufferToBase64(content instanceof Blob ? await content.arrayBuffer() : content);
                await this.filesystem.saveBinaryFile(b64, fullPath + '.b64');
            } else {
                await this.filesystem.saveFile(content, fullPath);
            }
        }

        this.enabledMods.add(modId);
        this._saveEnabledSet();
        await this._loadMod(modId);
    }

    /**
     * Uninstall a mod and clean up its blocks/textures.
     * @param {string} modId
     */
    async uninstallMod(modId) {
        // Remove from enabled set
        this.enabledMods.delete(modId);
        this._saveEnabledSet();

        // Unregister blocks
        const entry = this.mods.get(modId);
        if (entry) {
            for (const blockId of entry.blockIds) {
                this.minecraft.registerBlockClass(blockId, null, null); // unregister
            }
            this.mods.delete(modId);
        }

        // Delete stored files
        const files = await this.filesystem.listDir(`mods/${modId}/`);
        for (const f of files) {
            await this.filesystem.deleteFile(f);
        }

        console.log(`[ModLoader] Uninstalled mod '${modId}'`);
    }

    /**
     * Toggle a mod on/off without uninstalling.
     */
    async toggleMod(modId, enabled) {
        if (enabled) {
            this.enabledMods.add(modId);
            if (!this.mods.has(modId)) {
                await this._loadMod(modId);
            }
        } else {
            this.enabledMods.delete(modId);
            const entry = this.mods.get(modId);
            if (entry) {
                for (const blockId of entry.blockIds) {
                    // Mark as disabled — blocks stay registered but are not usable
                }
            }
        }
        this._saveEnabledSet();
    }

    /**
     * Get metadata for all installed mods.
     * @returns {Promise<Array<{id:string, name:string, author:string, version:string, enabled:boolean}>>}
     */
    async getInstalledMods() {
        const modIds = await this.getInstalledModIds();
        const result = [];
        for (const modId of modIds) {
            try {
                const raw = await this.filesystem.loadFile(`mods/${modId}/ModData.json`);
                if (!raw) continue;
                const meta = JSON.parse(raw);
                result.push({
                    id: meta.ID || modId,
                    name: meta.NAME || 'Unknown',
                    author: meta.AUTHOR || 'Unknown',
                    version: meta.VERSION || '0.0.0',
                    enabled: this.enabledMods.has(modId)
                });
            } catch (e) {
                console.warn(`[ModLoader] Could not read metadata for '${modId}':`, e);
            }
        }
        return result;
    }

    /**
     * Return list of mod IDs that have a ModData.json stored.
     */
    async getInstalledModIds() {
        const allFiles = await this.filesystem.listDir('mods/');
        const modIdSet = new Set();
        for (const f of allFiles) {
            // Files look like: mods/<modId>/ModData.json
            const match = f.match(/^mods\/([^/]+)\/ModData\.json$/);
            if (match) modIdSet.add(match[1]);
        }
        return [...modIdSet];
    }

    /**
     * Get a loaded mod entry.
     * @param {string} modId
     * @returns {ModEntry|undefined}
     */
    getMod(modId) {
        return this.mods.get(modId);
    }

    /**
     * Resolve a namespaced texture key '<modId>:<name>' to texture atlas data.
     * Returns { modId, textureName } or null.
     */
    resolveTexture(namespacedKey) {
        if (!namespacedKey || !namespacedKey.includes(':')) return null;
        const colonIndex = namespacedKey.indexOf(':');
        const modId = namespacedKey.substring(0, colonIndex);
        const textureName = namespacedKey.substring(colonIndex + 1);
        const entry = this.mods.get(modId);
        if (!entry) {
            console.warn(`[ModLoader] Unknown mod '${modId}' for texture '${namespacedKey}'`);
            return null;
        }
        return { modId, textureName };
    }

    /**
     * Load a mod's texture as an HTMLImageElement from IndexedDB.
     * @param {string} modId
     * @param {string} textureName  e.g. 'unbreakable_block'
     * @returns {Promise<HTMLImageElement>}
     */
    async loadModTexture(modId, textureName) {
        const b64Path = `mods/${modId}/textures/${textureName}.png.b64`;
        const b64data = await this.filesystem.loadBinaryFile(b64Path);
        if (!b64data) {
            throw new Error(`Mod texture not found: ${b64Path}`);
        }
        return new Promise((resolve, reject) => {
            const blob = new Blob([b64data], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to decode mod texture: ${textureName}`)); };
            img.src = url;
        });
    }

    /* ------------------------------------------------------------------
     *  Internal — load a single mod from IndexedDB
     * ------------------------------------------------------------------ */

    async _loadMod(modId) {
        // 1. Read metadata
        const raw = await this.filesystem.loadFile(`mods/${modId}/ModData.json`);
        if (!raw) throw new Error(`ModData.json not found for mod '${modId}'`);
        const modData = JSON.parse(raw);

        const entry = {
            id: modData.ID || modId,
            name: modData.NAME || 'Unknown',
            author: modData.AUTHOR || 'Unknown',
            version: modData.VERSION || '0.0.0',
            blockIds: [],
            blockClasses: new Map(),  // blockId → blockClass
            textureNames: []         // texture filenames (without .png)
        };

        // 2. Discover block JS files
        const allFiles = await this.filesystem.listDir(`mods/${modId}/`);
        const modPrefix = `mods/${modId}/`;
        const relFiles = allFiles.map(f => f.startsWith(modPrefix) ? f.slice(modPrefix.length) : f);
        const blockFiles = relFiles
            .filter(f => f.startsWith('blocks/') && f.endsWith('.js'))
            .map(f => f.replace(/^blocks\//, ''));

        // 3. Discover texture files
        entry.textureNames = relFiles
            .filter(f => f.startsWith('textures/') && f.endsWith('.png.b64'))
            .map(f => f.replace(/^textures\//, '').replace(/\.png\.b64$/, ''));

        // 4. Register mod textures into the TextureAtlas
        await this._registerModTextures(modId, entry);

        // 5. Load and register block classes
        await this._registerModBlocks(modId, entry, blockFiles);

        // 6. Store
        this.mods.set(modId, entry);

        console.log(`[ModLoader] Loaded mod '${entry.name}' — ${entry.blockIds.length} block(s), ${entry.textureNames.length} texture(s)`);
    }

    /* ------------------------------------------------------------------
     *  Internal — register mod textures into TextureAtlas
     * ------------------------------------------------------------------ */

    async _registerModTextures(modId, entry) {
        const atlas = this.minecraft.worldRenderer?.textureAtlas;
        if (!atlas) {
            console.warn('[ModLoader] TextureAtlas not ready, skipping texture registration');
            return;
        }

        for (const texName of entry.textureNames) {
            try {
                const img = await this.loadModTexture(modId, texName);
                const namespacedKey = `${modId}:${texName}`;
                // Use the atlas's dynamic registration method
                atlas.registerModTexture(namespacedKey, img);
            } catch (err) {
                console.warn(`[ModLoader] Failed to register texture '${texName}' for mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — load block JS files, eval classes, register with BlockRegistry
     * ------------------------------------------------------------------ */

    async _registerModBlocks(modId, entry, blockFiles) {
        // Get the Block base class for sandboxing
        const BlockClass = await this._getBlockClass();

        for (const filename of blockFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/blocks/${filename}`);
                if (!src) continue;

                const blockClass = this._evalBlockClass(src, BlockClass);
                if (!blockClass) continue;

                // Derive block ID from class name
                const className = blockClass.name || filename.replace('.js', '');
                const blockId = ModLoader.classToBlockId(className);
                const namespacedId = `${modId}:${blockId}`;

                // Register with BlockRegistry via Minecraft's exposed method
                const registered = this.minecraft.registerBlockClass(
                    namespacedId,
                    blockId,  // display name
                    blockClass
                );

                if (registered) {
                    registered.mod = entry.name;
                    entry.blockIds.push(namespacedId);
                    entry.blockClasses.set(namespacedId, blockClass);
                    console.log(`[ModLoader]   Registered block '${namespacedId}' from ${filename}`);
                }
            } catch (err) {
                console.error(`[ModLoader] Failed to load block '${filename}' from mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — eval a block class from source string
     * ------------------------------------------------------------------ */

    /**
     * Evaluate a block class source string and return the constructor.
     * We rewrite the `import Block from ...` to use the real Block class.
     */
    _evalBlockClass(source, BlockClass) {
        // Rewrite: import Block from "../Block.js"  (or any path)
        //   → const Block = __Block__;
        let transformed = source.replace(
            /import\s+Block\s+from\s+["'][^"']*["']\s*;?/g,
            ''
        );

        // Also handle: import Anything from "..." that isn't Block
        // Strip all imports since they won't resolve in sandbox
        transformed = transformed.replace(
            /import\s+.*?from\s+["'][^"']*["']\s*;?/g,
            ''
        );

        // Remove `export default` so we can capture the class
        transformed = transformed.replace(/export\s+default\s+class\s+(\w+)/, 'class $1');

        // Wrap in a function that receives Block as a parameter
        const wrapped = `
            return (function(__Block__) {
                "use strict";
                const Block = __Block__;
                ${transformed}
                return ${this._extractClassName(source)} || null;
            })
        `;

        try {
            const factory = new Function(wrapped)();
            return factory(BlockClass);
        } catch (err) {
            console.error('[ModLoader] Block eval error:', err);
            return null;
        }
    }

    /**
     * Extract the class name from 'export default class BlockFoo ...'
     */
    _extractClassName(source) {
        const match = source.match(/export\s+default\s+class\s+(\w+)/);
        return match ? match[1] : null;
    }

    /* ------------------------------------------------------------------
     *  Internal — read ModData from ZIP
     * ------------------------------------------------------------------ */

    async _readModDataFromZip(zip) {
        let modDataSrc = null;

        // Try ModData.js first
        for (const [path, entry] of Object.entries(zip.files)) {
            if (path === 'ModData.js' || path.endsWith('/ModData.js')) {
                modDataSrc = await entry.async('string');
                break;
            }
        }

        if (!modDataSrc) {
            throw new Error('ModData.js not found in the ZIP archive.');
        }

        return this._parseModDataSource(modDataSrc);
    }

    /**
     * Parse ModData.js source and extract static properties.
     */
    _parseModDataSource(source) {
        // Remove import/export noise
        let cleaned = source.replace(/export\s+default\s+class\s+\w+\s*\{/, '{');
        cleaned = cleaned.replace(/import\s+.*?from\s+["'][^"']*["']\s*;?/g, '');
        cleaned = cleaned.replace(/\}\s*;?\s*$/, '}');

        // Replace static properties with a plain object
        cleaned = cleaned.replace(/static\s+(\w+)\s*=/g, '$1 =');

        // Wrap and eval
        const wrapped = `return (function() { ${cleaned} return { NAME, ID, AUTHOR, VERSION }; })()`;
        try {
            return new Function(wrapped)();
        } catch (err) {
            console.error('[ModLoader] ModData parse error:', err);
            return { NAME: 'Unknown', ID: 'unknown', AUTHOR: 'Unknown', VERSION: '0.0.0' };
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — utilities
     * ------------------------------------------------------------------ */

    /**
     * Convert a Block class name to a snake_case block ID.
     * BlockUnbreakableBlock → UnbreakableBlock → unbreakable_block
     */
    static classToBlockId(className) {
        let name = className;
        // Strip leading 'Block' prefix
        if (name.startsWith('Block')) {
            name = name.substring(5);
        }
        // CamelCase / PascalCase → snake_case
        return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Dynamically import the Block base class.
     */
    async _getBlockClass() {
        if (this._blockBaseClass) return this._blockBaseClass;
        // Block is already imported in Minecraft.js and exposed globally for mod use
        if (window.__ModBlockClass__) {
            this._blockBaseClass = window.__ModBlockClass__;
            return this._blockBaseClass;
        }
        // Fallback: dynamic import
        try {
            const mod = await import('./world/block/Block.js');
            this._blockBaseClass = mod.default;
            window.__ModBlockClass__ = this._blockBaseClass;
            return this._blockBaseClass;
        } catch (e) {
            console.error('[ModLoader] Could not import Block class:', e);
            return class EmptyBlock {};
        }
    }

    /**
     * Ensure JSZip is loaded.
     */
    async _ensureJSZip() {
        if (window.JSZip) return window.JSZip;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'libraries/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('Failed to load JSZip library'));
            document.head.appendChild(script);
        });
    }

    async _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /* ------------------------------------------------------------------
     *  Internal — persistence of enabled set
     * ------------------------------------------------------------------ */

    _loadEnabledSet() {
        try {
            const stored = localStorage.getItem('breakmine_enabled_mods');
            if (stored) {
                const arr = JSON.parse(stored);
                this.enabledMods = new Set(arr);
            }
        } catch (e) {
            this.enabledMods = new Set();
        }
    }

    _saveEnabledSet() {
        try {
            localStorage.setItem('breakmine_enabled_mods', JSON.stringify([...this.enabledMods]));
        } catch (e) {
            console.warn('[ModLoader] Could not save enabled mods:', e);
        }
    }
}

/**
 * @typedef {Object} ModEntry
 * @property {string} id
 * @property {string} name
 * @property {string} author
 * @property {string} version
 * @property {string[]} blockIds
 * @property {Map<string, Function>} blockClasses
 * @property {string[]} textureNames
 */
