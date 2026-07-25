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
            'torch_on': 14
        };

        for (const [name, slotId] of Object.entries(mapping)) {
            this.textureNameToSlotId.set(name, slotId);
        }
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

    async getTextureFiles() {
        // Only include textures that actually exist and are used by our blocks
        const knownTextures = [
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
            "furnace_front_off.png",
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
            "acacia_log_top.png"
        ];

        // Map to the actual resource paths
        return knownTextures.map(name => 'terrain/pack/minecraft/textures/blocks/' + name);
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

    getTextureName(path) {
        // Extract filename from path and remove .png extension
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        return filename.replace('.png', '');
    }

    getTextureCoords(textureName) {
        const coords = this.textureMap.get(textureName);
        if (!coords) {
            console.warn(`Texture not found: ${textureName}`);
            return { x: 0, y: 0, index: 0 };
        }
        return coords;
    }

    getTextureIndex(textureName) {
        const coords = this.textureMap.get(textureName);
        return coords ? coords.index : 0;
    }

    getTextureNameByIndex(index) {
        return this.reverseTextureMap.get(index) || null;
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
