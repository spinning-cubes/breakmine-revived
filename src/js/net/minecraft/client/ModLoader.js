import FileSystem from "./fs/Filesystem.js";
import { BlockRegistry } from "./world/block/BlockRegistry.js";

/**
 * ModLoader — discovers, installs, and registers mods.
 *
 * Supported mod layout (inside a ZIP or folder):
 *   ModData.js          — metadata (static NAME, ID, AUTHOR, VERSION)
 *   ModLoad.js          — lifecycle hook (static onLoad(world))
 *   blocks/*.js          — block classes (extend Block)
 *   items/*.js           — item classes (extend Item / ItemGeneric / ItemEdible / ItemTool)
 *   textures/*.png       — 16×16 block/item textures
 *
 * Block naming convention:
 *   BlockUnbreakableBlock  →  strip "Block"  →  UnbreakableBlock  →  unbreakable_block
 *   Final namespaced ID:  <modId>:unbreakable_block
 *
 * Item naming convention:
 *   ItemTestItem          →  strip "Item"   →  TestItem          →  test_item
 *   Final namespaced ID:  <modId>:test_item
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

        // --- 4. Extract files from ZIP ---
        for (const [path, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;

            if (path === 'ModLoad.js') {
                const src = await entry.async('string');
                await this.filesystem.saveFile(src, `mods/${modId}/ModLoad.js`);
            } else if (path.startsWith('blocks/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/blocks/${filename}`);
            } else if (path.startsWith('items/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/items/${filename}`);
            } else if (path.startsWith('textures/') && path.endsWith('.png')) {
                const b64 = await entry.async('base64');
                const filename = path.split('/').pop();
                await this.filesystem.saveBinaryFile(b64, `mods/${modId}/textures/${filename}.b64`);
            }
        }

        // --- 5. Enable & load ---
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
        this.enabledMods.delete(modId);
        this._saveEnabledSet();

        const entry = this.mods.get(modId);
        if (entry) {
            for (const blockId of entry.blockIds) {
                BlockRegistry.unregister(blockId);
            }
            for (const itemId of entry.itemIds) {
                BlockRegistry.unregister(itemId);
            }
            this.mods.delete(modId);
        }

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
            blockClasses: new Map(),
            itemIds: [],
            itemClasses: new Map(),
            textureNames: []
        };

        // 2. Discover files
        const allFiles = await this.filesystem.listDir(`mods/${modId}/`);
        const modPrefix = `mods/${modId}/`;
        const relFiles = allFiles.map(f => f.startsWith(modPrefix) ? f.slice(modPrefix.length) : f);

        const blockFiles = relFiles
            .filter(f => f.startsWith('blocks/') && f.endsWith('.js'))
            .map(f => f.replace(/^blocks\//, ''));

        const itemFiles = relFiles
            .filter(f => f.startsWith('items/') && f.endsWith('.js'))
            .map(f => f.replace(/^items\//, ''));

        entry.textureNames = relFiles
            .filter(f => f.startsWith('textures/') && f.endsWith('.png.b64'))
            .map(f => f.replace(/^textures\//, '').replace(/\.png\.b64$/, ''));

        // 3. Register mod textures into the TextureAtlas
        await this._registerModTextures(modId, entry);

        // 4. Load and register block classes
        await this._registerModBlocks(modId, entry, blockFiles);

        // 5. Load and register item classes
        await this._registerModItems(modId, entry, itemFiles);

        // 6. Call ModLoad.onLoad if present
        await this._callModLoad(modId, entry);

        // 7. Store
        this.mods.set(modId, entry);

        console.log(`[ModLoader] Loaded mod '${entry.name}' — ${entry.blockIds.length} block(s), ${entry.itemIds.length} item(s), ${entry.textureNames.length} texture(s)`);
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
        const BlockClass = await this._getBlockClass();

        const BoundingBoxClass = await this._getBoundingBox();

        for (const filename of blockFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/blocks/${filename}`);
                if (!src) continue;

                const blockClass = this._evalClass(src, { Block: BlockClass, BlockRegistry, BoundingBox: BoundingBoxClass });
                if (!blockClass) continue;

                const className = blockClass.name || filename.replace('.js', '');
                const blockId = ModLoader.classToBlockId(className);
                const namespacedId = `${modId}:${blockId}`;

                const registered = this.minecraft.registerBlockClass(
                    namespacedId,
                    blockId,
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
     *  Internal — load item JS files, eval classes, register with BlockRegistry
     * ------------------------------------------------------------------ */

    async _registerModItems(modId, entry, itemFiles) {
        const itemClasses = await this._getItemClasses();

        for (const filename of itemFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/items/${filename}`);
                if (!src) continue;

                const itemClass = this._evalClass(src, itemClasses);
                if (!itemClass) continue;

                const className = itemClass.name || filename.replace('.js', '');
                const itemId = ModLoader.classToItemId(className);
                const namespacedId = `${modId}:${itemId}`;

                const registered = this.minecraft.registerBlockClass(
                    namespacedId,
                    itemId,
                    itemClass
                );

                if (registered) {
                    registered.mod = entry.name;
                    entry.itemIds.push(namespacedId);
                    entry.itemClasses.set(namespacedId, itemClass);
                    console.log(`[ModLoader]   Registered item '${namespacedId}' from ${filename}`);
                }
            } catch (err) {
                console.error(`[ModLoader] Failed to load item '${filename}' from mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — call ModLoad.onLoad if present
     * ------------------------------------------------------------------ */

    async _callModLoad(modId, entry) {
        try {
            const src = await this.filesystem.loadFile(`mods/${modId}/ModLoad.js`);
            if (!src) return;

            let transformed = src.replace(/import\s+.*?from\s+["'][^"']*["']\s*;?/g, '');
            transformed = transformed.replace(/export\s+default\s+class\s+(\w+)/, 'class $1');

            const wrapped = `
                return (function() {
                    "use strict";
                    ${transformed}
                    if (typeof ModLoad !== 'undefined' && ModLoad.onLoad) {
                        return ModLoad;
                    }
                    return null;
                })
            `;

            const factory = new Function(wrapped)();
            const modLoadClass = factory();
            if (modLoadClass && typeof modLoadClass.onLoad === 'function') {
                modLoadClass.onLoad(this.minecraft.world);
                console.log(`[ModLoader]   Called ModLoad.onLoad for '${modId}'`);
            }
        } catch (err) {
            console.warn(`[ModLoader] Failed to load ModLoad.js for '${modId}':`, err);
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — eval a class from source string with provided dependencies
     * ------------------------------------------------------------------ */

    /**
     * Evaluate a class source string and return the constructor.
     * Strips all imports and provides the named classes from the deps map.
     *
     * @param {string} source  — JavaScript source with `export default class`
     * @param {Object<string, Function>} deps  — map of variable names to actual classes
     * @returns {Function|null}
     */
    _evalClass(source, deps) {
        // Strip all imports
        let transformed = source.replace(
            /import\s+.*?from\s+["'][^"']*["']\s*;?/g,
            ''
        );

        // Remove `export default` so we can capture the class
        transformed = transformed.replace(/export\s+default\s+class\s+(\w+)/, 'class $1');

        // Build variable assignments from provided classes
        const assignments = Object.keys(deps).map(name =>
            `const ${name} = __deps__["${name}"];`
        ).join('\n');

        const wrapped = `
            return (function(__deps__) {
                "use strict";
                ${assignments}
                ${transformed}
                return ${this._extractClassName(source)} || null;
            })
        `;

        try {
            const factory = new Function(wrapped)();
            return factory(deps);
        } catch (err) {
            console.error('[ModLoader] Class eval error:', err);
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
        let cleaned = source.replace(/export\s+default\s+class\s+\w+\s*\{/, '{');
        cleaned = cleaned.replace(/import\s+.*?from\s+["'][^"']*["']\s*;?/g, '');
        cleaned = cleaned.replace(/\}\s*;?\s*$/, '}');
        cleaned = cleaned.replace(/static\s+(\w+)\s*=/g, '$1 =');

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
        if (name.startsWith('Block')) {
            name = name.substring(5);
        }
        return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Convert an Item class name to a snake_case item ID.
     * ItemTestItem → TestItem → test_item
     */
    static classToItemId(className) {
        let name = className;
        if (name.startsWith('Item')) {
            name = name.substring(4);
        }
        return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Dynamically import the Block base class.
     */
    async _getBlockClass() {
        if (this._blockBaseClass) return this._blockBaseClass;
        if (window.__ModBlockClass__) {
            this._blockBaseClass = window.__ModBlockClass__;
            if (!this._boundingBoxClass) {
                try {
                    const bbMod = await import('../util/BoundingBox.js');
                    this._boundingBoxClass = bbMod.default;
                } catch (e) {}
            }
            return this._blockBaseClass;
        }
        try {
            const [mod, bbMod] = await Promise.all([
                import('./world/block/Block.js'),
                import('../util/BoundingBox.js')
            ]);
            this._blockBaseClass = mod.default;
            this._boundingBoxClass = bbMod.default;
            window.__ModBlockClass__ = this._blockBaseClass;
            return this._blockBaseClass;
        } catch (e) {
            console.error('[ModLoader] Could not import Block class:', e);
            return class EmptyBlock {};
        }
    }

    async _getBoundingBox() {
        if (this._boundingBoxClass) return this._boundingBoxClass;
        await this._getBlockClass();
        if (this._boundingBoxClass) return this._boundingBoxClass;
        try {
            const bbMod = await import('../util/BoundingBox.js');
            this._boundingBoxClass = bbMod.default;
            return this._boundingBoxClass;
        } catch (e) {
            console.error('[ModLoader] Could not import BoundingBox class:', e);
            return class EmptyBoundingBox {};
        }
    }

    /**
     * Dynamically import item base classes for mod sandboxing.
     */
    async _getItemClasses() {
        const BlockClass = await this._getBlockClass();
        const BoundingBoxClass = await this._getBoundingBox();
        try {
            const itemMod = await import('./world/block/Item.js');
            const genericMod = await import('./world/block/type/ItemGeneric.js');
            const edibleMod = await import('./world/block/ItemEdible.js');
            const toolMod = await import('./world/block/type/ItemTool.js');
            return {
                Block: BlockClass,
                BlockRegistry,
                BoundingBox: BoundingBoxClass,
                Item: itemMod.default,
                ItemGeneric: genericMod.default,
                ItemEdible: edibleMod.default,
                ItemTool: toolMod.default
            };
        } catch (e) {
            console.error('[ModLoader] Could not import Item classes:', e);
            return { Block: BlockClass, BlockRegistry, BoundingBox: BoundingBoxClass, Item: class EmptyItem extends BlockClass {} };
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
 * @property {string[]} itemIds
 * @property {Map<string, Function>} itemClasses
 * @property {string[]} textureNames
 */
