import * as THREE from "../../../../../../libraries/three.module.js";

export default class TextureAtlas {

    constructor(minecraft, texturePath = "terrain/pack/minecraft/textures/blocks/") {
        this.minecraft = minecraft;
        this.texturePath = texturePath;
        this.textureSize = 16; // Each texture is 16x16
        this.atlasSize = 256; // Standard atlas size (16x16 textures)
        this.texturesPerRow = this.atlasSize / this.textureSize; // 16 textures per row
        
        this.textureMap = new Map(); // Maps texture name to atlas coordinates
        this.reverseTextureMap = new Map(); // Maps atlas index to texture name
        this.textureNameToSlotId = new Map(); // Maps texture name to original terrain.png slot ID
        this.canvas = null;
        this.texture = null;
        this.loaded = false;
        this._nextModIndex = 0; // Tracks next available slot for mod textures
        
        // Initialize texture name to slot ID mapping
        this.initializeTextureNameToSlotId();
    }

    initializeTextureNameToSlotId() {
        // Map texture names to their original terrain.png slot IDs
        // This is needed for particles which still use terrain.png
        const mapping = {
            'stone': 0,
            'dirt': 1,
            'grass_top': 2,
            'grass_side': 3,
            'cobblestone': 4,
            'planks_oak': 5,
            'bedrock': 6,
            'sand': 7,
            'gravel': 8,
            'log_oak': 9,
            'log_oak_top': 10,
            'leaves_oak_opaque': 11,
            'glass': 12,
            'water_still': 13,
            'torch_on': 14,
            'apple': 15
        };

        for (const [name, slotId] of Object.entries(mapping)) {
            this.textureNameToSlotId.set(name, slotId);
        }
    }

    registerTexture(name, slotId) {
        this.textureNameToSlotId.set(name, slotId);
    }

    /**
     * Resize the atlas to accommodate mod textures.
     * Call BEFORE loadTextures() if you expect many mods.
     * @param {number} newSize  Must be a multiple of textureSize (16). e.g. 512 for 1024 slots.
     */
    resizeAtlas(newSize = 512) {
        if (this.loaded) {
            console.warn('[TextureAtlas] Cannot resize atlas after textures are loaded.');
            return;
        }
        if (newSize % this.textureSize !== 0) {
            console.warn(`[TextureAtlas] Atlas size ${newSize} is not a multiple of texture size ${this.textureSize}`);
            return;
        }
        this.atlasSize = newSize;
        this.texturesPerRow = this.atlasSize / this.textureSize;
        console.log(`[TextureAtlas] Resized to ${newSize}x${newSize} (${this.texturesPerRow}x${this.texturesPerRow} slots)`);
    }

    async loadTextures() {
        // Create canvas for the atlas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.atlasSize;
        this.canvas.height = this.atlasSize;
        const ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Get all texture files from the blocks directory
        const textureFiles = await this.getTextureFiles();
        
        // Load and arrange textures on the atlas
        let index = 0;
        for (const textureFile of textureFiles) {
            if (index >= this.texturesPerRow * this.texturesPerRow) {
                console.warn("Texture atlas full, skipping remaining textures");
                break;
            }

            try {
                const textureName = this.getTextureName(textureFile);
                const image = await this.loadImage(textureFile);
                
                // Calculate position on atlas
                const x = (index % this.texturesPerRow) * this.textureSize;
                const y = Math.floor(index / this.texturesPerRow) * this.textureSize;
                
                // Draw texture onto atlas
                ctx.drawImage(image, x, y, this.textureSize, this.textureSize);
                
                // Store mapping
                this.textureMap.set(textureName, { x, y, index });
                if (textureName === "oak_planks") {
                    this.textureMap.set("planks_oak", { x, y, index });
                    this.reverseTextureMap.set(index, "planks_oak");
                }
                this.reverseTextureMap.set(index, textureName);
                
                index++;
            } catch (error) {
                console.error(`Failed to load texture: ${textureFile}`, error);
            }
        }

        // Set the mod texture starting index after all vanilla textures
        this._nextModIndex = index;

        // Create THREE texture from canvas
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.wrapS = THREE.RepeatWrapping;
        this.texture.wrapT = THREE.RepeatWrapping;
        this.texture.generateMipmaps = false;
        
        this.loaded = true;
        console.log(`Texture atlas loaded with ${index} textures`);
        
        return this.texture;
    }

    /**
     * Register a mod texture from an HTMLImageElement into the next available atlas slot.
     * @param {string} namespacedKey  e.g. 'unbreakable_block:unbreakable_block'
     * @param {HTMLImageElement} image  16x16 pixel image
     * @returns {{ x: number, y: number, index: number }} atlas coordinates
     */
    registerModTexture(namespacedKey, image) {
        if (!this.canvas) {
            console.warn('[TextureAtlas] Cannot register mod texture — atlas not yet built.');
            return { x: 0, y: 0, index: 0 };
        }

        const maxSlots = this.texturesPerRow * this.texturesPerRow;
        if (this._nextModIndex >= maxSlots) {
            console.error(`[TextureAtlas] Atlas full (${maxSlots} slots). Cannot register mod texture '${namespacedKey}'.`);
            return { x: 0, y: 0, index: 0 };
        }

        const index = this._nextModIndex++;
        const x = (index % this.texturesPerRow) * this.textureSize;
        const y = Math.floor(index / this.texturesPerRow) * this.textureSize;

        const ctx = this.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, this.textureSize, this.textureSize, x, y, this.textureSize, this.textureSize);

        const coords = { x, y, index };
        this.textureMap.set(namespacedKey, coords);
        this.reverseTextureMap.set(index, namespacedKey);

        // Flag the THREE texture for GPU re-upload
        if (this.texture) {
            this.texture.needsUpdate = true;
        }

        console.log(`[TextureAtlas] Registered mod texture '${namespacedKey}' at slot ${index} (${x}, ${y})`);
        return coords;
    }

    async getTextureFiles() {
        const blockTextures = [
            "stone.png",
            "dirt.png",
            "grass_top.png",
            "grass_side.png",
            "cobblestone.png",
            "oak_planks.png",
            "bedrock.png",
            "sand.png",
            "gravel.png",
            "log_oak.png",
            "log_oak_top.png",
            "leaves_oak_opaque.png",
            "glass.png",
            "water_still.png",
            "torch_on.png",
            "grass_path_top.png",
            "grass_path_side.png",
            "coal_ore.png",
            "iron_ore.png",
            "diamond_ore.png",
            "emerald_ore.png",
            "gold_ore.png",
            "iron_block.png",
            "gold_block.png",
            "diamond_block.png",
            "emerald_block.png",
            "coal_block.png",
            "crafting_table_top.png",
            "crafting_table_side.png",
            "crafting_table_front.png",
            "chest_bottom.png",
            "chest_side.png",
            "chest_front.png",
            "missing.png",
            "brick.png",
            "furnace_front.png",
            "furnace_front_on.png",
            "furnace_side.png",
            "furnace_top.png",
            "bush.png",
            "bush2.png",
            "bush3.png",
            "destroy_stage_0.png",
            "destroy_stage_1.png",
            "destroy_stage_2.png",
            "destroy_stage_3.png",
            "destroy_stage_4.png",
            "destroy_stage_5.png",
            "destroy_stage_6.png",
            "destroy_stage_7.png",
            "destroy_stage_8.png",
            "destroy_stage_9.png",
            "oak_leaves.png",
            "oak_log.png",
            "oak_log_top.png",
            "white_wool.png",
            "orange_wool.png",
            "magenta_wool.png",
            "light_blue_wool.png",
            "yellow_wool.png",
            "lime_wool.png",
            "pink_wool.png",
            "gray_wool.png",
            "light_gray_wool.png",
            "cyan_wool.png",
            "purple_wool.png",
            "blue_wool.png",
            "brown_wool.png",
            "green_wool.png",
            "red_wool.png",
            "black_wool.png",
            "tan_wool.png",
            "lava.png",
            "logic.png",
            "mossy_cobblestone.png",
            "spruce_planks.png",
            "birch_planks.png",
            "jungle_planks.png",
            "acacia_planks.png",
            "oak_log.png",
            "oak_log_top.png",
            "spruce_log.png",
            "spruce_log_top.png",
            "birch_log.png",
            "birch_log_top.png",
            "jungle_log.png",
            "jungle_log_top.png",
            "acacia_log.png",
            "acacia_log_top.png",
            "beans.png",
            "moldy_beans.png",
            "redstone_dust_dot.png",
            "redstone_dust_line.png",
            "redstone_dust_line0.png",
            "redstone_dust_line1.png",
            "redstone_dust_cross.png",
            "redstone_dust_overlay.png",
            "none.png",
            "sapphire_ore.png",
            "sapphire_block.png",
            "bluestone_ore.png",
            "slime_block_nontransparent.png",
            "wire.png",
            "stonebrick.png",
            "dark_stonebrick.png",
            "oak_door_top.png",
            "oak_door_bottom.png",
            "bluestoneBlock.png",
            "bluestoneDust0000.png",
            "bluestoneDust0001.png",
            "bluestoneDust0010.png",
            "bluestoneDust0011.png",
            "bluestoneDust0100.png",
            "bluestoneDust0101.png",
            "bluestoneDust0110.png",
            "bluestoneDust0111.png",
            "bluestoneDust1000.png",
            "bluestoneDust1001.png",
            "bluestoneDust1010.png",
            "bluestoneDust1011.png",
            "bluestoneDust1100.png",
            "bluestoneDust1101.png",
            "bluestoneDust1110.png",
            "bluestoneDust1111.png",
            "bluestoneLampOff.png",
            "bluestoneLampOn.png",
            "bluestoneBulbOff.png",
            "bluestoneBulbOn.png",
            "bluestonePusherOn.png",
            "bluestonePusherOff.png",
            "bluestoneStickyPusherOff.png",
            "piston_top_sticky.png",
            "cobblestone_frame.png",
            "cobblestone_frame_on.png",
            "bluestoneRepeaterFront.png",
            "bluestoneRepeaterBack.png",
            "bluestoneObserverFront.png",
            "bluestoneObserverBackOn.png",
            "bluestoneObserverBackOff.png",
            "oak_planks_green.png",
            "oak_planks_sticky.png",
            "bluestoneRepeaterTopOff.png",
            "bluestoneRepeaterTopOn.png",
            "lever.png",
            "cobblestone_lever_base.png"
        ];

        const toolTextureNames = [];
        const toolMaterials = ['wooden', 'stone', 'iron', 'diamond', 'golden'];
        const toolTypes = ['pickaxe', 'sword', 'shovel', 'axe', 'hoe'];
        for (const mat of toolMaterials) {
            for (const type of toolTypes) {
                toolTextureNames.push(`${mat}_${type}.png`);
            }
        }

        const itemTextures = [
            "apple.png",
            "bread.png",
            "stick.png",
            "iron_ingot.png",
            "coal.png",
            "diamond.png",
            "emerald.png",
            "gold_ingot.png",
            "bucket.png",
            "water_bucket.png",
            "lava_bucket.png",
            "oak_sign.png",
            "oak_door.png",
            ...toolTextureNames
        ];

        // If using texture pack, adjust paths
        if (this.texturePath.startsWith('texture_packs/')) {
            const packId = this.texturePath.split('/')[1];
            return [
                ...blockTextures.map(name => 'blocks/' + name),
                ...itemTextures.map(name => 'items/' + name)
            ];
        }

        return [
            ...blockTextures.map(name => 'terrain/pack/minecraft/textures/blocks/' + name),
            ...itemTextures.map(name => 'terrain/pack/minecraft/textures/items/' + name)
        ];
    }

    loadImage(path) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            
            // Check if texture exists in resources
            if (this.minecraft.resources && this.minecraft.resources[path]) {
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
                image.src = this.minecraft.resources[path].src;
            } else if (this.texturePath.startsWith('texture_packs/')) {
                // Load from texture pack filesystem
                const packId = this.texturePath.split('/')[1];
                // path might be just filename or full path
                let relativePath = path;
                if (path.includes('/')) {
                    relativePath = path.replace(/^terrain\/pack\/minecraft\/textures\/blocks\//, '').replace(/^terrain\/pack\/minecraft\/textures\/items\//, '');
                }
                const fsPath = `texture_packs/${packId}/${relativePath}.b64`;
                
                if (this.minecraft.filesystem) {
                    this.minecraft.filesystem.loadBinaryFile(fsPath)
                        .then(data => {
                            if (data) {
                                const blob = new Blob([data], { type: 'image/png' });
                                const imageUrl = URL.createObjectURL(blob);
                                image.onload = () => {
                                    URL.revokeObjectURL(imageUrl);
                                    resolve(image);
                                };
                                image.onerror = () => {
                                    URL.revokeObjectURL(imageUrl);
                                    reject(new Error(`Failed to load image: ${path}`));
                                };
                                image.src = imageUrl;
                            } else {
                                // Fall back to default texture
                                this.loadDefaultTexture(path, image, resolve, reject);
                            }
                        })
                        .catch(error => {
                            console.warn(`Failed to load from texture pack: ${error.message}, falling back to default`);
                            this.loadDefaultTexture(path, image, resolve, reject);
                        });
                } else {
                    this.loadDefaultTexture(path, image, resolve, reject);
                }
            } else {
                // Try loading from filesystem using fetch
                fetch(`src/resources/${path}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const imageUrl = URL.createObjectURL(blob);
                        image.onload = () => {
                            URL.revokeObjectURL(imageUrl);
                            resolve(image);
                        };
                        image.onerror = () => {
                            URL.revokeObjectURL(imageUrl);
                            reject(new Error(`Failed to load image: ${path}`));
                        };
                        image.src = imageUrl;
                    })
                    .catch(error => {
                        reject(new Error(`Failed to fetch image: ${path} - ${error.message}`));
                    });
            }
        });
    }

    loadDefaultTexture(path, image, resolve, reject) {
        // Fall back to default texture path (Simplistic)
        let defaultPath = path;
        
        // If path is just filename (from simplified structure), construct default path
        if (!path.includes('/')) {
            // Try blocks first, then items
            defaultPath = 'terrain/pack/minecraft/textures/blocks/' + path;
        } else if (path.startsWith('blocks/')) {
            defaultPath = 'terrain/pack/minecraft/textures/' + path;
        } else if (path.startsWith('items/')) {
            defaultPath = 'terrain/pack/minecraft/textures/' + path;
        } else {
            // Handle other path formats
            defaultPath = path.replace(/^texture_packs\/[^\/]+\//, 'terrain/pack/minecraft/textures/blocks/');
        }
        
        fetch(`src/resources/${defaultPath}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                const imageUrl = URL.createObjectURL(blob);
                image.onload = () => {
                    URL.revokeObjectURL(imageUrl);
                    resolve(image);
                };
                image.onerror = () => {
                    URL.revokeObjectURL(imageUrl);
                    reject(new Error(`Failed to load image: ${defaultPath}`));
                };
                image.src = imageUrl;
            })
            .catch(error => {
                reject(new Error(`Failed to fetch default image: ${defaultPath} - ${error.message}`));
            });
    }

    getTextureName(path) {
        // Extract filename from path and remove .png extension
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        return filename.replace('.png', '');
    }

    getTextureCoords(textureName) {
        // Direct lookup (handles both vanilla and namespaced mod textures)
        const coords = this.textureMap.get(textureName);
        if (coords) return coords;

        console.warn(`Texture not found: ${textureName}`);
        return { x: 0, y: 0, index: 0 };
    }

    getTextureIndex(textureName) {
        const coords = this.textureMap.get(textureName);
        return coords ? coords.index : 0;
    }

    getTextureNameByIndex(index) {
        return this.reverseTextureMap.get(index) || null;
    }

    /**
     * Check if a texture key is namespaced (mod texture).
     * @param {string} name
     * @returns {{ modId: string, textureName: string } | null}
     */
    parseModTextureKey(name) {
        if (!name || !name.includes(':')) return null;
        const colonIndex = name.indexOf(':');
        return {
            modId: name.substring(0, colonIndex),
            textureName: name.substring(colonIndex + 1)
        };
    }


    getTexture() {
        return this.texture;
    }

    isLoaded() {
        return this.loaded;
    }

    // Get UV coordinates for a texture (0-1 range)
    getUVs(textureName) {
        const coords = this.getTextureCoords(textureName);
        const u = coords.x / this.atlasSize;
        const v = coords.y / this.atlasSize;
        const size = this.textureSize / this.atlasSize;
        
        return {
            minU: u,
            maxU: u + size,
            minV: v,
            maxV: v + size
        };
    }
}
