import CraftingRegistry from "./crafting/CraftingRegistry.js";
import FileSystem from "./fs/Filesystem.js";
import EnumCreativeInventoryTab from "./gui/EnumCreativeInventoryTab.js";
import { BlockRegistry } from "./world/block/BlockRegistry.js";
import * as THREE from "../../../../../libraries/three.module.js";

/**
 * ModLoader — discovers, installs, and registers mods.
 *
 * Supported mod layout (inside a ZIP or folder):
 *   ModData.js           — metadata (static NAME, ID, AUTHOR, VERSION)
 *   ModLoad.js           — lifecycle hook (static onLoad(world))
 *   blocks/*.js          — block classes (extend Block)
 *   items/*.js           — item classes (extend Item / ItemGeneric / ItemEdible / ItemTool)
 *   crafting/*.js        — crafting recipe classes
 *   smelting/*.js        — smelting recipe classes
 *   gui/*.js             — GUI screen classes (extend GuiScreen / GuiContainer)
 *   gui_textures/*.png   — GUI background textures (accessible via 'gui/&lt;modId&gt;/&lt;name&gt;')
 *   textures/*.png       — 16×16 block/item textures
 *
 * Block naming convention:
 *   BlockUnbreakableBlock  →  strip "Block"  →  UnbreakableBlock  →  unbreakable_block
 *   Final namespaced ID:  <modId>:unbreakable_block
 *
 * Item naming convention:
 *   ItemTestItem          →  strip "Item"   →  TestItem          →  test_item
 *   Final namespaced ID:  <modId>:test_item
 *
 * GUI classes loaded from gui/ are automatically available in block/item eval
 * sandboxes so blocks can `new GuiMyScreen(...)` in onMouseButton.
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
        console.log(`[Patchwork] Found ${modIds.length} installed mod(s)`);

        for (const modId of modIds) {
            if (!this.enabledMods.has(modId)) continue;
            try {
                await this._loadMod(modId);
            } catch (err) {
                console.error(`[Patchwork] Failed to load mod '${modId}':`, err);
            }
        }

        console.log(`[Patchwork] ${this.mods.size} mod(s) loaded successfully`);
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

        console.log(`[Patchwork] Installing mod '${modData.NAME}' (${modId}) v${modData.VERSION}`);

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
            } else if (path.startsWith('crafting/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/crafting/${filename}`);
            } else if (path.startsWith('smelting/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/smelting/${filename}`);
            } else if (path.startsWith('gui/') && path.endsWith('.js')) {
                const src = await entry.async('string');
                const filename = path.split('/').pop();
                await this.filesystem.saveFile(src, `mods/${modId}/gui/${filename}`);
            } else if (path.startsWith('gui_textures/') && path.endsWith('.png')) {
                const b64 = await entry.async('base64');
                const filename = path.split('/').pop();
                await this.filesystem.saveBinaryFile(b64, `mods/${modId}/gui_textures/${filename}.b64`);
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
        console.log(`[Patchwork] Loading mod from folder: ${modId}`);

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

        console.log(`[Patchwork] Uninstalled mod '${modId}'`);
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
                console.warn(`[Patchwork] Could not read metadata for '${modId}':`, e);
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
            console.warn(`[Patchwork] Unknown mod '${modId}' for texture '${namespacedKey}'`);
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
            guiClasses: new Map(),
            guiTextureNames: [],
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

        const craftingFiles = relFiles
            .filter(f => f.startsWith('crafting/') && f.endsWith('.js'))
            .map(f => f.replace(/^crafting\//, ''));

        const smeltingFiles = relFiles
            .filter(f => f.startsWith('smelting/') && f.endsWith('.js'))
            .map(f => f.replace(/^smelting\//, ''));

        const guiFiles = relFiles
            .filter(f => f.startsWith('gui/') && f.endsWith('.js'))
            .map(f => f.replace(/^gui\//, ''));

        entry.guiTextureNames = relFiles
            .filter(f => f.startsWith('gui_textures/') && f.endsWith('.png.b64'))
            .map(f => f.replace(/^gui_textures\//, '').replace(/\.png\.b64$/, ''));

        entry.textureNames = relFiles
            .filter(f => f.startsWith('textures/') && f.endsWith('.png.b64'))
            .map(f => f.replace(/^textures\//, '').replace(/\.png\.b64$/, ''));

        // 3. Register mod textures into the TextureAtlas
        await this._registerModTextures(modId, entry);

        // 4. Register GUI textures into minecraft.resources
        await this._registerModGuiTextures(modId, entry);

        // 5. Load and register GUI classes (before blocks so blocks can reference them)
        await this._registerModGuis(modId, entry, guiFiles);

        // 6. Load and register block classes (may reference GUI classes)
        await this._registerModBlocks(modId, entry, blockFiles);

        // 7. Load and register item classes
        await this._registerModItems(modId, entry, itemFiles);

        // 8. Register crafting recipes
        await this._registerModCrafting(modId, entry, craftingFiles);

        // 9. Register smelting recipes
        await this._registerModSmelting(modId, entry, smeltingFiles);

        // 10. Call ModLoad.onLoad if present
        await this._callModLoad(modId, entry);

        // 11. Store
        this.mods.set(modId, entry);

        console.log(`[Patchwork] Loaded mod '${entry.name}' — ${entry.blockIds.length} block(s), ${entry.itemIds.length} item(s), ${entry.textureNames.length} texture(s)`);
    }

    /* ------------------------------------------------------------------
     *  Internal — register mod textures into TextureAtlas
     * ------------------------------------------------------------------ */

    async _registerModTextures(modId, entry) {
        const atlas = this.minecraft.worldRenderer?.textureAtlas;
        if (!atlas) {
            console.warn('[Patchwork] TextureAtlas not ready, skipping texture registration');
            return;
        }

        for (const texName of entry.textureNames) {
            try {
                const img = await this.loadModTexture(modId, texName);
                const namespacedKey = `${modId}:${texName}`;
                atlas.registerModTexture(namespacedKey, img);
            } catch (err) {
                console.warn(`[Patchwork] Failed to register texture '${texName}' for mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — load block JS files, eval classes, register with BlockRegistry
     * ------------------------------------------------------------------ */

    async _registerModBlocks(modId, entry, blockFiles) {
        const BlockClass = await this._getBlockClass();

        const BoundingBoxClass = await this._getBoundingBox();

        const EnumBlockFaceClass = await this._getEnumBlockFace();

        const EnumCreativeInventoryTabClass = await this._getEnumCreativeInventoryTab();

        // Build deps: base block deps + any GUI classes from this mod
        const blockDeps = { Block: BlockClass, BlockRegistry, BoundingBox: BoundingBoxClass, EnumBlockFace: EnumBlockFaceClass, EnumCreativeInventoryTab: EnumCreativeInventoryTabClass, THREE };
        for (const [className, cls] of entry.guiClasses) {
            blockDeps[className] = cls;
        }

        for (const filename of blockFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/blocks/${filename}`);
                if (!src) continue;

                const blockClass = this._evalClass(src, blockDeps);
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
                    registered.inventoryTab = EnumCreativeInventoryTab.MATERIALS;
                    entry.blockIds.push(namespacedId);
                    entry.blockClasses.set(namespacedId, blockClass);
                    console.log(`[Patchwork] Registered block '${namespacedId}' from ${filename}`);
                }
            } catch (err) {
                console.error(`[Patchwork] Failed to load block '${filename}' from mod '${modId}':`, err);
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
                    registered.inventoryTab = EnumCreativeInventoryTab.MATERIALS;
                    entry.itemIds.push(namespacedId);
                    entry.itemClasses.set(namespacedId, itemClass);
                    console.log(`[Patchwork]   Registered item '${namespacedId}' from ${filename}`);
                }
            } catch (err) {
                console.error(`[Patchwork] Failed to load item '${filename}' from mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — register crafting recipes
     * ------------------------------------------------------------------ */

    async _registerModCrafting(modId, entry, craftingFiles) {
        for (const filename of craftingFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/crafting/${filename}`);
                if (!src) continue;

                let transformed = src.replace(/import\s+.*?from\s+["'][^"']*["']\s*;?/g, '');
                transformed = transformed.replace(/export\s+default\s+class\s+(\w+)/, 'class $1');

                const match = transformed.match(/class\s+(\w+)/);
                if (!match) continue;
                const className = match[1];

                // Extract block name: BlockOakTableCrafting → OakTable
                let blockName = className;
                if (blockName.startsWith('Block')) blockName = blockName.substring(5);
                if (blockName.endsWith('Crafting')) blockName = blockName.slice(0, -8);
                const blockId = blockName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
                const namespacedId = `${modId}:${blockId}`;

                const resultBlock = BlockRegistry.get(namespacedId);
                if (!resultBlock) {
                    console.warn(`[Patchwork] Crafting recipe '${filename}' target block '${namespacedId}' not found, skipping`);
                    continue;
                }
                const resultTypeId = resultBlock.id;

                const wrapped = `
                    return (function() {
                        "use strict";
                        ${transformed}
                        if (typeof ${className} !== 'undefined') {
                            return ${className};
                        }
                        return null;
                    })
                `;
                const factory = new Function(wrapped)();
                const recipeClass = factory();
                if (!recipeClass) continue;

                const resultCount = recipeClass.amount_output || 1;
                const ingredients = recipeClass.recipe || [];
                const shapeless = recipeClass.shapeless === true;

                if (ingredients.length === 0) {
                    console.warn(`[Patchwork] Crafting recipe '${filename}' has no ingredients, skipping`);
                    continue;
                }

                if (shapeless) {
                    CraftingRegistry.registerShapelessRecipe(resultTypeId, resultCount, ingredients);
                } else {
                    let width = recipeClass.width || 0;
                    let height = recipeClass.height || 0;
                    if (!width || !height) {
                        if (ingredients.length === 1) { width = 1; height = 1; }
                        else if (ingredients.length === 4) { width = 2; height = 2; }
                        else if (ingredients.length === 9) { width = 3; height = 3; }
                        else if (ingredients.length % 3 === 0) { width = 3; height = ingredients.length / 3; }
                        else if (ingredients.length % 2 === 0) { width = 2; height = ingredients.length / 2; }
                        else { width = ingredients.length; height = 1; }
                    }
                    CraftingRegistry.registerShapedRecipe(resultTypeId, resultCount, width, height, ingredients);
                }

                console.log(`[Patchwork] Registered crafting recipe for '${namespacedId}' from ${filename}`);
            } catch (err) {
                console.error(`[Patchwork] Failed to load crafting recipe '${filename}' from mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — register smelting recipes
     * ------------------------------------------------------------------ */

    async _registerModSmelting(modId, entry, smeltingFiles) {
        try {
            const { default: SmeltingRecipe } = await import('./smelting/SmeltingRecipe.js');
            const { SmeltingRegistry } = await import('./smelting/SmeltingRegistry.js');

            for (const filename of smeltingFiles) {
                try {
                    const src = await this.filesystem.loadFile(`mods/${modId}/smelting/${filename}`);
                    if (!src) continue;

                    let transformed = src.replace(/import\s+.*?from\s+["'][^"']*["']\s*;?/g, '');
                    transformed = transformed.replace(/export\s+default\s+class\s+(\w+)/, 'class $1');

                    const match = transformed.match(/class\s+(\w+)/);
                    if (!match) continue;
                    const className = match[1];

                    // Extract block name: BlockOakTableSmelting → OakTable
                    let blockName = className;
                    if (blockName.startsWith('Block')) blockName = blockName.substring(5);
                    if (blockName.endsWith('Smelting')) blockName = blockName.slice(0, -8);
                    const blockId = blockName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
                    const namespacedId = `${modId}:${blockId}`;

                    const resultBlock = BlockRegistry.get(namespacedId);
                    if (!resultBlock) {
                        console.warn(`[Patchwork] Smelting recipe '${filename}' target block '${namespacedId}' not found, skipping`);
                        continue;
                    }
                    const resultTypeId = resultBlock.id;

                    const wrapped = `
                        return (function() {
                            "use strict";
                            ${transformed}
                            if (typeof ${className} !== 'undefined') {
                                return ${className};
                            }
                            return null;
                        })
                    `;
                    const factory = new Function(wrapped)();
                    const recipeClass = factory();
                    if (!recipeClass) continue;

                    const inputId = recipeClass.input || 0;
                    const resultCount = recipeClass.amount_output || 1;
                    if (inputId) {
                        SmeltingRegistry.registerRecipe(new SmeltingRecipe(inputId, resultTypeId, resultCount));
                        console.log(`[Patchwork]   Registered smelting recipe for '${namespacedId}' from ${filename}`);
                    }
                } catch (err) {
                    console.error(`[Patchwork] Failed to load smelting recipe '${filename}' from mod '${modId}':`, err);
                }
            }
        } catch (err) {
            console.error(`[Patchwork] Could not import SmeltingRecipe/SmeltingRegistry for mod '${modId}':`, err);
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — register GUI textures into minecraft.resources
     * ------------------------------------------------------------------ */

    async _registerModGuiTextures(modId, entry) {
        for (const texName of entry.guiTextureNames) {
            try {
                const b64Path = `mods/${modId}/gui_textures/${texName}.png.b64`;
                const b64data = await this.filesystem.loadBinaryFile(b64Path);
                if (!b64data) continue;

                const img = await new Promise((resolve, reject) => {
                    const blob = new Blob([b64data], { type: 'image/png' });
                    const url = URL.createObjectURL(blob);
                    const image = new Image();
                    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
                    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to decode GUI texture: ${texName}`)); };
                    image.src = url;
                });

                const resourceKey = `gui/${modId}/${texName}`;
                this.minecraft.resources[resourceKey] = img;
                console.log(`[Patchwork]   Registered GUI texture '${resourceKey}'`);
            } catch (err) {
                console.warn(`[Patchwork] Failed to register GUI texture '${texName}' for mod '${modId}':`, err);
            }
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — dynamically import GUI base classes for mod sandboxing
     * ------------------------------------------------------------------ */

    async _getGuiDeps() {
        try {
            const [GuiScreen, GuiContainer, GuiBase, ContainerCls, SlotCls, InventoryBasic, ItemStack, GuiButton] = await Promise.all([
                import('./gui/GuiScreen.js').then(m => m.default),
                import('./gui/screens/GuiContainer.js').then(m => m.default),
                import('./gui/Gui.js').then(m => m.default),
                import('./inventory/Container.js').then(m => m.default),
                import('./inventory/Slot.js').then(m => m.default),
                import('./inventory/inventory/InventoryBasic.js').then(m => m.default),
                import('./item/ItemStack.js').then(m => m.default),
                import('./gui/widgets/GuiButton.js').then(m => m.default),
            ]);

            const BlockClass = await this._getBlockClass();
            const BoundingBoxClass = await this._getBoundingBox();
            const EnumCreativeInventoryTabClass = await this._getEnumCreativeInventoryTab();

            return {
                GuiScreen,
                GuiContainer,
                Gui: GuiBase,
                Container: ContainerCls,
                Slot: SlotCls,
                InventoryBasic,
                ItemStack,
                GuiButton,
                Block: BlockClass,
                BlockRegistry,
                BoundingBox: BoundingBoxClass,
                EnumCreativeInventoryTab: EnumCreativeInventoryTabClass,
            };
        } catch (e) {
            console.error('[Patchwork] Could not import GUI classes:', e);
            return { GuiScreen: class EmptyScreen {} };
        }
    }

    /* ------------------------------------------------------------------
     *  Internal — load GUI JS files and store class constructors
     * ------------------------------------------------------------------ */

    async _registerModGuis(modId, entry, guiFiles) {
        const guiDeps = await this._getGuiDeps();

        for (const filename of guiFiles) {
            try {
                const src = await this.filesystem.loadFile(`mods/${modId}/gui/${filename}`);
                if (!src) continue;

                const guiClass = this._evalClass(src, guiDeps);
                if (!guiClass) continue;

                const className = guiClass.name || filename.replace('.js', '');
                entry.guiClasses.set(className, guiClass);
                console.log(`[Patchwork] Loaded GUI '${className}' from ${filename}`);
            } catch (err) {
                console.error(`[Patchwork] Failed to load GUI '${filename}' from mod '${modId}':`, err);
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
                console.log(`[Patchwork]   Called ModLoad.onLoad for '${modId}'`);
            }
        } catch (err) {
            console.warn(`[Patchwork] Failed to load ModLoad.js for '${modId}':`, err);
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
            console.error('[Patchwork] Class eval error:', err);
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
            console.error('[Patchwork] ModData parse error:', err);
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
            console.error('[Patchwork] Could not import Block class:', e);
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
            console.error('[Patchwork] Could not import BoundingBox class:', e);
            return class EmptyBoundingBox {};
        }
    }

    async _getEnumBlockFace() {
        if (this._enumBlockFaceClass) return this._enumBlockFaceClass;
        try {
            const mod = await import('../util/EnumBlockFace.js');
            this._enumBlockFaceClass = mod.default;
            return this._enumBlockFaceClass;
        } catch (e) {
            console.error('[Patchwork] Could not import EnumBlockFace class:', e);
            return class EmptyFace {};
        }
    }

    async _getEnumCreativeInventoryTab() {
        if (this._enumCreativeInventoryTabClass) return this._enumCreativeInventoryTabClass;
        try {
            const mod = await import('./gui/EnumCreativeInventoryTab.js');
            this._enumCreativeInventoryTabClass = mod.default;
            return this._enumCreativeInventoryTabClass;
        } catch (e) {
            console.error('[Patchwork] Could not import EnumCreativeInventoryTab class:', e);
            return class EmptyEnumCreativeInventoryTab {};
        }
    }

    /**
     * Dynamically import item base classes for mod sandboxing.
     */
    async _getItemClasses() {
        const BlockClass = await this._getBlockClass();
        const BoundingBoxClass = await this._getBoundingBox();
        const EnumCreativeInventoryTabClass = await this._getEnumCreativeInventoryTab();
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
                ItemTool: toolMod.default,
                EnumCreativeInventoryTab: EnumCreativeInventoryTabClass,
                THREE
            };
        } catch (e) {
            console.error('[Patchwork] Could not import Item classes:', e);
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
            console.warn('[Patchwork] Could not save enabled mods:', e);
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
 * @property {Map<string, Function>} guiClasses
 * @property {string[]} guiTextureNames
 * @property {string[]} textureNames
 */
