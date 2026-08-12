export default class LightPropagator {

    constructor(world) {
        this.world = world;
    }

    /**
     * Propagate light from a source point within a bounding box
     * @param {number} sourceX - Source X coordinate
     * @param {number} sourceY - Source Y coordinate
     * @param {number} sourceZ - Source Z coordinate
     * @param {number} lightLevel - Initial light level (0-15)
     * @param {number} radius - Propagation radius in blocks
     * @param {boolean} isDynamic - Whether this is dynamic light (from held items)
     * @returns {Map} - Map of "x,y,z" -> {sky, block, dynamic} light values
     */
    propagateLight(sourceX, sourceY, sourceZ, lightLevel, radius, isDynamic = false) {
        const lightMap = new Map();
        const queue = [];
        
        // Add source to queue
        queue.push({ x: sourceX, y: sourceY, z: sourceZ, level: lightLevel });
        
        // BFS propagation
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y},${current.z}`;
            
            // Skip if already processed with higher light
            const existing = lightMap.get(key);
            if (existing && existing.level >= current.level) {
                continue;
            }
            
            // Store light value
            lightMap.set(key, {
                sky: isDynamic ? 0 : current.level,
                block: isDynamic ? current.level : 0,
                dynamic: isDynamic ? current.level : 0,
                level: current.level
            });
            
            // Stop if light level is too low
            if (current.level <= 1) {
                continue;
            }
            
            // Propagate to neighbors
            const neighbors = [
                { x: current.x + 1, y: current.y, z: current.z },
                { x: current.x - 1, y: current.y, z: current.z },
                { x: current.x, y: current.y + 1, z: current.z },
                { x: current.x, y: current.y - 1, z: current.z },
                { x: current.x, y: current.y, z: current.z + 1 },
                { x: current.x, y: current.y, z: current.z - 1 }
            ];
            
            for (const neighbor of neighbors) {
                // Check if within radius
                const dx = neighbor.x - sourceX;
                const dy = neighbor.y - sourceY;
                const dz = neighbor.z - sourceZ;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance > radius) {
                    continue;
                }
                
                // Check if block allows light to pass
                const blockId = this.world.getBlockAt(neighbor.x, neighbor.y, neighbor.z);
                const block = blockId !== 0 ? this.world.getBlockById(blockId) : null;
                
                let lightReduction = 1;
                if (block) {
                    const opacity = block.getOpacity();
                    lightReduction = Math.max(1, opacity);
                }
                
                const newLevel = current.level - lightReduction;
                if (newLevel > 0) {
                    queue.push({ x: neighbor.x, y: neighbor.y, z: neighbor.z, level: newLevel });
                }
            }
        }
        
        return lightMap;
    }

    /**
     * Get combined light values for a position from the light map and world
     * @param {Map} lightMap - Light propagation map
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} z - Z coordinate
     * @returns {Object} - {sky, block, dynamic} light values (0-15)
     */
    getCombinedLight(lightMap, x, y, z) {
        const key = `${x},${y},${z}`;
        const propagated = lightMap.get(key);
        
        // Get base light from world
        let skyLight = 0;
        let blockLight = 0;
        
        try {
            if (this.world.blockExists(x, y, z)) {
                skyLight = this.world.getSavedLightValue(0, x, y, z); // EnumSkyBlock.SKY
                blockLight = this.world.getSavedLightValue(1, x, y, z); // EnumSkyBlock.BLOCK
            }
        } catch (e) {
            // Block doesn't exist or chunk not loaded
        }
        
        // Combine with propagated dynamic light
        let dynamicLight = 0;
        if (propagated && propagated.dynamic > 0) {
            dynamicLight = propagated.dynamic;
        }
        
        return {
            sky: skyLight / 15,
            block: blockLight / 15,
            dynamic: dynamicLight / 15
        };
    }

    /**
     * Propagate multiple light sources and combine their effects
     * @param {Array} sources - Array of {x, y, z, level} objects
     * @param {number} radius - Propagation radius
     * @param {boolean} isDynamic - Whether these are dynamic lights
     * @returns {Map} - Combined light map
     */
    propagateMultipleLights(sources, radius, isDynamic = false) {
        const combinedMap = new Map();
        
        for (const source of sources) {
            const lightMap = this.propagateLight(
                source.x, source.y, source.z, 
                source.level, radius, isDynamic
            );
            
            // Merge with combined map, taking maximum light values
            for (const [key, value] of lightMap) {
                const existing = combinedMap.get(key);
                if (!existing || value.level > existing.level) {
                    combinedMap.set(key, value);
                }
            }
        }
        
        return combinedMap;
    }
}
