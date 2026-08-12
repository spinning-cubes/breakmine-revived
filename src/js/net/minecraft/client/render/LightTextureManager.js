import * as THREE from "../../../../../../libraries/three.module.js";

export default class LightTextureManager {

    constructor(worldSize = 256) {
        // 3D texture for storing light values (R = sky light, G = block light, B = dynamic light)
        this.worldSize = worldSize;
        this.lightTextureSize = 64; // Size of the 3D texture (can be smaller than world)
        this.lightTextureScale = this.lightTextureSize / worldSize;
        
        // Create 3D texture
        this.lightTexture = new THREE.DataTexture3D(
            new Uint8Array(this.lightTextureSize * this.lightTextureSize * this.lightTextureSize * 3),
            this.lightTextureSize,
            this.lightTextureSize,
            this.lightTextureSize
        );
        
        this.lightTexture.format = THREE.RGBFormat;
        this.lightTexture.type = THREE.UnsignedByteType;
        this.lightTexture.minFilter = THREE.LinearFilter;
        this.lightTexture.magFilter = THREE.LinearFilter;
        this.lightTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.lightTexture.wrapT = THREE.ClampToEdgeWrapping;
        this.lightTexture.wrapR = THREE.ClampToEdgeWrapping;
        
        this.lightTexture.needsUpdate = true;
        
        // Cache for light updates to avoid redundant texture uploads
        this.dirtyRegions = new Map(); // Key: "x,y,z" -> {x, y, z, size}
    }

    /**
     * Update light values in a local bounding box
     * @param {number} worldX - World X coordinate
     * @param {number} worldY - World Y coordinate  
     * @param {number} worldZ - World Z coordinate
     * @param {number} size - Size of the bounding box (cubic)
     * @param {Function} getLightFn - Function(x, y, z) that returns {sky, block, dynamic} light values
     */
    updateLightRegion(worldX, worldY, worldZ, size, getLightFn) {
        const halfSize = Math.floor(size / 2);
        const startX = worldX - halfSize;
        const startY = worldY - halfSize;
        const startZ = worldZ - halfSize;
        
        const data = this.lightTexture.image.data;
        
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                for (let dz = 0; dz < size; dz++) {
                    const wx = startX + dx;
                    const wy = startY + dy;
                    const wz = startZ + dz;
                    
                    // Convert world coordinates to texture coordinates
                    const tx = Math.floor((wx / this.worldSize) * this.lightTextureSize);
                    const ty = Math.floor((wy / this.worldSize) * this.lightTextureSize);
                    const tz = Math.floor((wz / this.worldSize) * this.lightTextureSize);
                    
                    // Clamp to texture bounds
                    if (tx < 0 || tx >= this.lightTextureSize ||
                        ty < 0 || ty >= this.lightTextureSize ||
                        tz < 0 || tz >= this.lightTextureSize) {
                        continue;
                    }
                    
                    // Get light values from world
                    const light = getLightFn(wx, wy, wz);
                    
                    // Update texture data
                    const index = (tx + ty * this.lightTextureSize + tz * this.lightTextureSize * this.lightTextureSize) * 3;
                    data[index] = Math.floor(light.sky * 255);     // R = sky light
                    data[index + 1] = Math.floor(light.block * 255); // G = block light
                    data[index + 2] = Math.floor(light.dynamic * 255); // B = dynamic light
                }
            }
        }
        
        this.lightTexture.needsUpdate = true;
    }

    /**
     * Mark a region as dirty for later batch update
     */
    markDirtyRegion(x, y, z, size) {
        const key = `${x},${y},${z}`;
        this.dirtyRegions.set(key, { x, y, z, size });
    }

    /**
     * Upload all dirty regions to the GPU
     */
    flushDirtyRegions(getLightFn) {
        for (const [key, region] of this.dirtyRegions) {
            this.updateLightRegion(region.x, region.y, region.z, region.size, getLightFn);
        }
        this.dirtyRegions.clear();
    }

    /**
     * Get the Three.js 3D texture for use in shaders
     */
    getTexture() {
        return this.lightTexture;
    }

    /**
     * Get the scale factor for converting world coordinates to texture coordinates
     */
    getScale() {
        return this.lightTextureScale;
    }

    /**
     * Initialize the light texture with base world lighting data
     * @param {World} world - The world instance
     * @param {Function} getLightFn - Function(x, y, z) that returns {sky, block} light values
     */
    initializeFromWorld(world, getLightFn) {
        const data = this.lightTexture.image.data;
        
        // Sample the world at a lower resolution for performance
        const sampleStep = Math.max(1, Math.floor(this.worldSize / this.lightTextureSize));
        
        for (let tx = 0; tx < this.lightTextureSize; tx++) {
            for (let ty = 0; ty < this.lightTextureSize; ty++) {
                for (let tz = 0; tz < this.lightTextureSize; tz++) {
                    // Convert texture coordinates to world coordinates
                    const wx = Math.floor((tx / this.lightTextureSize) * this.worldSize);
                    const wy = Math.floor((ty / this.lightTextureSize) * this.worldSize);
                    const wz = Math.floor((tz / this.lightTextureSize) * this.worldSize);
                    
                    // Get light values from world
                    let skyLight = 0;
                    let blockLight = 0;
                    
                    try {
                        if (world.blockExists(wx, wy, wz)) {
                            skyLight = world.getSavedLightValue(0, wx, wy, wz); // EnumSkyBlock.SKY
                            blockLight = world.getSavedLightValue(1, wx, wy, wz); // EnumSkyBlock.BLOCK
                        }
                    } catch (e) {
                        // Block doesn't exist or chunk not loaded
                    }
                    
                    // Update texture data
                    const index = (tx + ty * this.lightTextureSize + tz * this.lightTextureSize * this.lightTextureSize) * 3;
                    data[index] = Math.floor((skyLight / 15) * 255);     // R = sky light
                    data[index + 1] = Math.floor((blockLight / 15) * 255); // G = block light
                    data[index + 2] = 0; // B = dynamic light (initially 0)
                }
            }
        }
        
        this.lightTexture.needsUpdate = true;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.lightTexture.dispose();
        this.dirtyRegions.clear();
    }
}
