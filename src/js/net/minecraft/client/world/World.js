import ChunkSection from "./ChunkSection.js";
import MathHelper from "../../util/MathHelper.js";
import BoundingBox from "../../util/BoundingBox.js";
import EnumSkyBlock from "../../util/EnumSkyBlock.js";
import Block from "./block/Block.js";
import EnumBlockFace from "../../util/EnumBlockFace.js";
import Vector3 from "../../util/Vector3.js";
import Vector4 from "../../util/Vector4.js";
import MetadataChunkBlock from "../../util/MetadataChunkBlock.js";
import * as THREE from "../../../../../../libraries/three.module.js";

export default class World {

    static TOTAL_HEIGHT = ChunkSection.SIZE * 8; // 128 blocks high (Y 0..127)

    constructor(minecraft) {
        this.minecraft = minecraft;

        this.entities = [];

        this.group = new THREE.Object3D();
        this.group.matrixAutoUpdate = false;

        this.lightUpdateQueue = [];
        this.chunkProvider = null;

        this.time = 0;
        this.spawn = new Vector3(0, 0, 0);

        // Block tick system
        this.blockTickQueue = [];
        this.scheduledBlockTicks = new Map();

        // Store interval ID for cleanup
        this.lightUpdateInterval = null;

        // Update lights async
        let scope = this;
        this.lightUpdateInterval = setInterval(function () {
            let i = scope.minecraft.loadingScreen === null ? 1000 : 100000;
            while (scope.lightUpdateQueue.length >= 10 && i > 0) {
                i--;
                scope.lightUpdateQueue.shift().updateBlockLightning(scope);
            }
        }, 50);
    }

    getSeed() {
        return this.chunkProvider && this.chunkProvider.generator ? this.chunkProvider.generator.seed : 0;
    }

    cleanup() {
        // Clear light update interval to prevent stale state
        if (this.lightUpdateInterval !== null) {
            clearInterval(this.lightUpdateInterval);
            this.lightUpdateInterval = null;
        }
    }

    setChunkProvider(chunkProvider) {
        this.chunkProvider = chunkProvider;
    }

    onTick() {
        // Tick entities
        for (let i = 0; i < this.entities.length; i++) {
            this.entities[i].onUpdate();
        }

        // Process scheduled block ticks
        this.processBlockTicks();

        // Update skylight subtracted (To make the night dark)
        let lightLevel = this.calculateSkylightSubtracted(1.0);
        if (lightLevel !== this.skylightSubtracted) {
            this.skylightSubtracted = lightLevel;

            // Rebuild all chunks
            this.minecraft.worldRenderer.rebuildAll();
        }

        // Update world time
        this.time++;
    }

    scheduleBlockTick(x, y, z, delay) {
        let key = `${x},${y},${z}`;
        let tickTime = this.time + delay;
        this.scheduledBlockTicks.set(key, { x, y, z, tickTime });
    }

    processBlockTicks() {
        for (let [key, tick] of this.scheduledBlockTicks) {
            if (this.time >= tick.tickTime) {
                this.scheduledBlockTicks.delete(key);
                this.tickBlock(tick.x, tick.y, tick.z);
            }
        }
    }

    getCollisionBoxes(region) {
        let boundingBoxList = [];

        let minX = MathHelper.floor(region.minX);
        let maxX = MathHelper.floor(region.maxX + 1.0);
        let minY = MathHelper.floor(region.minY);
        let maxY = MathHelper.floor(region.maxY + 2.0);
        let minZ = MathHelper.floor(region.minZ);
        let maxZ = MathHelper.floor(region.maxZ + 1.0);

        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                for (let z = minZ; z < maxZ; z++) {
                    let collisionBoxes = this.getBlockCollisionBoxesAt(x, y, z);
                    if (collisionBoxes.length > 0) {
                        boundingBoxList.push(...collisionBoxes);
                    }
                }
            }
        }
        return boundingBoxList;
    }

    getBlockCollisionBoxesAt(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        if (typeId === 0) {
            return [];
        }

        let block = Block.getById(typeId);
        if (block === null) {
            return [];
        }

        if (block.multipart) {
            let multipart = block.getMultipart(this, x, y, z);
            if (Array.isArray(multipart) && multipart.length > 0) {
                return multipart.map((part) => {
                    let bbox = part[2];
                    if (!bbox) {
                        return null;
                    }

                    return new BoundingBox(
                        x + bbox.minX,
                        y + bbox.minY,
                        z + bbox.minZ,
                        x + bbox.maxX,
                        y + bbox.maxY,
                        z + bbox.maxZ
                    );
                }).filter((box) => box !== null);
            }
        }

        if (this.isHalfBlockAt(x, y, z)) {
            return [new BoundingBox(x, y, z, x + 1, y + 0.5, z + 1)];
        }

        if (block.isSolid()) {
            return [new BoundingBox(x, y, z, x + 1, y + 1, z + 1)];
        }

        // Liquids have no collision
        if (block.isLiquid()) {
            return [];
        }

        // Check for blocks with custom bounding box (e.g., torch)
        if (block.boundingBox) {
            return [new BoundingBox(
                x + block.boundingBox.minX,
                y + block.boundingBox.minY,
                z + block.boundingBox.minZ,
                x + block.boundingBox.maxX,
                y + block.boundingBox.maxY,
                z + block.boundingBox.maxZ
            )];
        }

        return [];
    }

    isSolidBlockAt(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        if (typeId === 0) {
            return false;
        }

        let block = Block.getById(typeId);
        return block !== null && !block.multipart && block.isSolid();
    }

    isHalfBlockAt(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        if (typeId === 0) {
            return false;
        }

        let block = Block.getById(typeId);
        return block !== null && block.isHalf(this, x, y, z);
    }

    tickBlock(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        if (typeId === 0) return;

        let block = Block.getById(typeId);
        if (block && block.onBlockTick) {
            block.onBlockTick(this, x, y, z);
        }
    }

    getChunkAt(x, z) {
        return this.chunkProvider.getChunkAt(x, z);
    }

    getChunkAtBlock(x, y, z) {
        const chunk = this.getChunkAt(x >> 4, z >> 4);
        if (!chunk) {
            return null;
        }

        const sectionY = y >> 4;
        if (sectionY < 0 || sectionY >= World.TOTAL_HEIGHT / ChunkSection.SIZE) {
            return null;
        }

        return chunk.getSection(sectionY);
    }

    getCollisionBoxes(region) {
        let boundingBoxList = [];

        let minX = MathHelper.floor(region.minX);
        let maxX = MathHelper.floor(region.maxX + 1.0);
        let minY = MathHelper.floor(region.minY);
        let maxY = MathHelper.floor(region.maxY + 1.0);
        let minZ = MathHelper.floor(region.minZ);
        let maxZ = MathHelper.floor(region.maxZ + 1.0);

        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                for (let z = minZ; z < maxZ; z++) {
                    let collisionBoxes = this.getBlockCollisionBoxesAt(x, y, z);
                    if (collisionBoxes.length > 0) {
                        boundingBoxList.push(...collisionBoxes);
                    }
                }
            }
        }
        return boundingBoxList;
    }

    updateLights() {
        let scope = this;

        if (this.lightUpdateQueue.length < 10) {
            // Update lights in queue
            let i = 10;
            while (scope.lightUpdateQueue.length > 0) {
                if (i <= 0) {
                    return true;
                }

                let meta = scope.lightUpdateQueue.shift();
                meta.updateBlockLightning(scope);
                i--;
            }
        }
        return false;
    }

    updateLight(sourceType, x1, y1, z1, x2, y2, z2, notifyNeighbor = true) {
        let centerX = (x2 + x1) / 2;
        let centerZ = (z2 + z1) / 2;

        if (!this.blockExists(centerX, 64, centerZ)) {
            return;
        }

        let size = this.lightUpdateQueue.length;

        if (notifyNeighbor) {
            let max = 4;
            if (max > size) {
                max = size;
            }
            for (let i = 0; i < max; i++) {
                let meta = this.lightUpdateQueue[(this.lightUpdateQueue.length - i - 1)];
                if (meta.type === sourceType && meta.isOutsideOf(x1, y1, z1, x2, y2, z2)) {
                    return;
                }
            }
        }

        let centerChunk = this.getChunkAt(centerX >> 4, centerZ >> 4);
        if (!centerChunk.loaded) {
            return;
        }

        // Skip if section has no blocks
        let section1 = this.getChunkSectionAt(x1 >> 4, y1 >> 4, z1 >> 4);
        let section2 = this.getChunkSectionAt(x2 >> 4, y2 >> 4, z2 >> 4);
        if (section1 === section2 && section1.isEmpty()) {
            return;
        }

        // Add light update region to queue
        if (this.lightUpdateQueue.length < 9999) {
            this.lightUpdateQueue.push(new MetadataChunkBlock(sourceType, x1, y1, z1, x2, y2, z2));
        }

        // Max light updates in queue
        if (this.lightUpdateQueue.length > 10000) {
            this.lightUpdateQueue = [];
        }
    }

    blockExists(x, y, z) {
        if (y < 0 || y >= World.TOTAL_HEIGHT) {
            return false;
        } else {
            return this.chunkExists(x >> 4, z >> 4);
        }
    }

    chunkExists(chunkX, chunkZ) {
        return this.chunkProvider !== null && this.chunkProvider.chunkExists(chunkX, chunkZ);
    }

    neighborLightPropagationChanged(sourceType, x, y, z, level) {
        if (!this.blockExists(x, y, z)) {
            return;
        }
        if (sourceType === EnumSkyBlock.SKY) {
            if (this.isAboveGround(x, y, z)) {
                level = 15;
            }
        } else if (sourceType === EnumSkyBlock.BLOCK) {
            let typeId = this.getBlockAt(x, y, z);
            let block = Block.getById(typeId);
            let blockLight = typeId === 0 ? 0 : block.getLightValue();

            if (blockLight > level) {
                level = blockLight;
            }
        }
        if (this.getSavedLightValue(sourceType, x, y, z) !== level) {
            this.updateLight(sourceType, x, y, z, x, y, z);
        }
    }

    /**
     * Get the first non-solid block
     */
    getHeightAt(x, z) {
        if (!this.chunkExists(x >> 4, z >> 4)) {
            return 0;
        }
        return this.getChunkAt(x >> 4, z >> 4).getHeightAt(x & 15, z & 15);
    }

    /**
     * Get the highest solid block
     */
    getHighestBlockAt(x, z) {
        if (!this.chunkExists(x >> 4, z >> 4)) {
            return 0;
        }
        return this.getChunkAt(x >> 4, z >> 4).getHighestBlockAt(x & 15, z & 15);
    }

    /**
     * Is the highest solid block or above
     */
    isHighestBlock(x, y, z) {
        let chunk = this.getChunkAt(x >> 4, z >> 4)
        return chunk.isHighestBlock(x & 15, y, z & 15);
    }

    /**
     * Is above the highest solid block
     */
    isAboveGround(x, y, z) {
        let chunk = this.getChunkAt(x >> 4, z >> 4)
        return chunk.isAboveGround(x & 15, y, z & 15);
    }

    getTotalLightAt(x, y, z) {
        if (!this.blockExists(x, y, z)) {
            return 15;
        }

        let section = this.getChunkSectionAt(x >> 4, y >> 4, z >> 4)
        return section.getTotalLightAt(x & 15, y & 15, z & 15);
    }

    getSavedLightValue(sourceType, x, y, z) {
        if (!this.blockExists(x, y, z)) {
            return 15;
        }

        let section = this.getChunkSectionAt(x >> 4, y >> 4, z >> 4)
        return section.getLightAt(sourceType, x & 15, y & 15, z & 15);
    }

    setLightAt(sourceType, x, y, z, lightLevel) {
        if (!this.blockExists(x, y, z)) {
            return;
        }

        let section = this.getChunkSectionAt(x >> 4, y >> 4, z >> 4);
        if (!section) {
            return;
        }

        section.setLightAt(sourceType, x & 15, y & 15, z & 15, lightLevel);

        // Rebuild chunk
        this.onBlockChanged(x, y, z);
    }

    isSolidBlockAt(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        if (typeId === 0) {
            return false;
        }

        let block = Block.getById(typeId);
        return block !== null && block.isSolid();
    }

    isTranslucentBlockAt(x, y, z) {
        let typeId = this.getBlockAt(x, y, z);
        return typeId === 0 || Block.getById(typeId).isTranslucent();
    }

    setBlockAt(x, y, z, type, data = 0) {
        if (y < 0 || y >= World.TOTAL_HEIGHT) {
            return;
        }

        let chunk = this.getChunkAt(x >> 4, z >> 4);
        chunk.setBlockAt(x & 15, y, z & 15, type, data);

        // Schedule ticks for adjacent blocks when a block is removed
        if (type === 0) {
            this.scheduleNeighborTicks(x, y, z);
        }

        // Rebuild chunk
        this.onBlockChanged(x, y, z);
    }

    scheduleNeighborTicks(x, y, z) {
        // Schedule ticks for all adjacent blocks
        let faces = [
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: -1, z: 0 }
        ];

        for (let face of faces) {
            let checkX = x + face.x;
            let checkY = y + face.y;
            let checkZ = z + face.z;

            let typeId = this.getBlockAt(checkX, checkY, checkZ);
            if (typeId !== 0) {
                let block = Block.getById(typeId);
                if (block && block.onBlockTick) {
                    this.scheduleBlockTick(checkX, checkY, checkZ, 1);
                }
            }
        }
    }

    setBlockDataAt(x, y, z, data) {
        this.getChunkAt(x >> 4, z >> 4).setBlockDataAt(x & 15, y, z & 15, data);
    }

    getBlockAt(x, y, z) {
        let chunkSection = this.getChunkAtBlock(x, y, z);
        return chunkSection == null ? 0 : chunkSection.getBlockAt(x & 15, y & 15, z & 15);
    }

    getBlockDataAt(x, y, z) {
        let chunkSection = this.getChunkAtBlock(x, y, z);
        return chunkSection == null ? 0 : chunkSection.getBlockDataAt(x & 15, y & 15, z & 15);
    }

    getBlockAtFace(x, y, z, face) {
        return this.getBlockAt(x + face.x, y + face.y, z + face.z);
    }

    getChunkSectionAt(chunkX, layerY, chunkZ) {
        const chunk = this.getChunkAt(chunkX, chunkZ);
        if (!chunk) {
            return null;
        }

        if (layerY < 0 || layerY >= World.TOTAL_HEIGHT / ChunkSection.SIZE) {
            return null;
        }

        return chunk.getSection(layerY);
    }

    onBlockChanged(x, y, z) {
        this.setModified(x - 1, y - 1, z - 1, x + 1, y + 1, z + 1);
    }

    setModified(minX, minY, minZ, maxX, maxY, maxZ) {
        // To chunk coordinates
        minX = minX >> 4;
        maxX = maxX >> 4;
        minY = minY >> 4;
        maxY = maxY >> 4;
        minZ = minZ >> 4;
        maxZ = maxZ >> 4;

        const maxSectionY = Math.max(0, Math.floor(World.TOTAL_HEIGHT / ChunkSection.SIZE) - 1);

        // Minimum and maximum y
        minY = Math.max(0, minY);
        maxY = Math.min(maxSectionY, maxY);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.chunkExists(x, z)) {
                        const section = this.getChunkSectionAt(x, y, z);
                        if (section) {
                            section.isModified = true;
                        }
                    }
                }
            }
        }
    }

   rayTraceBlocks(from, to, slab = false) {
        let toX = MathHelper.floor(to.x);
        let toY = MathHelper.floor(to.y);
        let toZ = MathHelper.floor(to.z);
    
        let x = MathHelper.floor(from.x);
        let y = MathHelper.floor(from.y);
        let z = MathHelper.floor(from.z);
    
        let blockId = this.getBlockAt(x, y, z);
        let block = Block.getById(blockId);
    
        if (block != null && block.canInteract()) {
            let hit = block.collisionRayTrace(this, x, y, z, from, to);
            if (hit != null) {
                // Check for slab condition
                //console.log(slab, from.y, y);
                if (slab) {
                    if (hit.face === EnumBlockFace.TOP) {
                        return 0;
                    }
                    if (hit.face === EnumBlockFace.BOTTOM) {
                        return 1;
                    }
                    if (from.y - y >= 0.5) {
                        return 1;
                    }
                }
                return hit;
            }
        }
    
        let lastHit = null;
    
        let counter = 200;
        while (counter-- >= 0) {
            if (x === toX && y === toY && z === toZ) {
                return lastHit;
            }
    
            let hitX = true;
            let hitY = true;
            let hitZ = true;
    
            let nearestX1 = 999.0;
            let nearestY1 = 999.0;
            let nearestZ1 = 999.0;
    
            if (toX > x) {
                nearestX1 = x + 1.0;
            } else if (toX < x) {
                nearestX1 = x;
            } else {
                hitX = false;
            }
    
            if (toY > y) {
                nearestY1 = y + 1.0;
            } else if (toY < y) {
                nearestY1 = y;
            } else {
                hitY = false;
            }
    
            if (toZ > z) {
                nearestZ1 = z + 1.0;
            } else if (toZ < z) {
                nearestZ1 = z;
            } else {
                hitZ = false;
            }
    
            let nearestX = 999.0;
            let nearestY = 999.0;
            let nearestZ = 999.0;
    
            let diffX = to.x - from.x;
            let diffY = to.y - from.y;
            let diffZ = to.z - from.z;
    
            if (hitX) {
                nearestX = (nearestX1 - from.x) / diffX;
            }
            if (hitY) {
                nearestY = (nearestY1 - from.y) / diffY;
            }
            if (hitZ) {
                nearestZ = (nearestZ1 - from.z) / diffZ;
            }
    
            if (nearestX === -0.0) {
                nearestX = -1.0E-4;
            }
            if (nearestY === -0.0) {
                nearestY = -1.0E-4;
            }
            if (nearestZ === -0.0) {
                nearestZ = -1.0E-4;
            }
    
            let face;
            if (nearestX < nearestY && nearestX < nearestZ) {
                face = toX > x ? EnumBlockFace.WEST : EnumBlockFace.EAST;
                from = new Vector3(nearestX1, from.y + diffY * nearestX, from.z + diffZ * nearestX);
            } else if (nearestY < nearestZ) {
                face = toY > y ? EnumBlockFace.BOTTOM : EnumBlockFace.TOP;
                from = new Vector3(from.x + diffX * nearestY, nearestY1, from.z + diffZ * nearestY);
            } else {
                face = toZ > z ? EnumBlockFace.NORTH : EnumBlockFace.SOUTH;
                from = new Vector3(from.x + diffX * nearestZ, from.y + diffY * nearestZ, nearestZ1);
            }
    
            x = MathHelper.floor(from.x) - (face === EnumBlockFace.EAST ? 1 : 0);
            y = MathHelper.floor(from.y) - (face === EnumBlockFace.TOP ? 1 : 0);
            z = MathHelper.floor(from.z) - (face === EnumBlockFace.SOUTH ? 1 : 0);
    
            blockId = this.getBlockAt(x, y, z);
            block = Block.getById(blockId);
            //console.log(blockId);

            if (blockId === 0) { 
                let blockBelowId = this.getBlockAt(x, y - 1, z);
                //console.log(blockBelowId);
                
                if (blockBelowId !== 0) { 
                    let blockBelow = Block.getById(blockBelowId);
                    
                    if (blockBelow != null && blockBelow.boundingBox && blockBelow.boundingBox.maxY > 1.0) {
                        y -= 1; 
                        blockId = blockBelowId;
                    }
                }
            }
    
            if (block != null && block.canInteract()) {
                let hit = block.collisionRayTrace(this, x, y, z, from, to);
                if (hit != null) {
                    // Check for slab condition
                    //console.log(slab, from.y, y);
                    if (slab) {
                        if (hit.face === EnumBlockFace.TOP) {
                            return 0;
                        }
                        if (hit.face === EnumBlockFace.BOTTOM) {
                            return 1;
                        }
                        if (from.y - y >= 0.5) {
                            return 1;
                        }
                    }
                    return hit;
                }
            }
        }
    
        return lastHit;
    }

    getCelestialAngle(partialTicks) {
        return MathHelper.calculateCelestialAngle(this.time, partialTicks);
    }

    getTemperature(x, y, z) {
        return 0.75; // TODO implement biomes
    }

    getHumidity(x, y, z) {
        return 0.85; // TODO implement biomes
    }

    getSkyColor(x, z, partialTicks) {
        let angle = this.getCelestialAngle(partialTicks);
        let brightness = Math.cos(angle * 3.141593 * 2.0) * 2.0 + 0.5;

        if (brightness < 0.0) {
            brightness = 0.0;
        }
        if (brightness > 1.0) {
            brightness = 1.0;
        }

        let temperature = this.getTemperature(x, z);
        let rgb = this.getSkyColorByTemp(temperature);

        let red = (rgb >> 16 & 0xff) / 255;
        let green = (rgb >> 8 & 0xff) / 255;
        let blue = (rgb & 0xff) / 255;

        red *= brightness;
        green *= brightness;
        blue *= brightness;

        return new Vector3(red, green, blue);
    }

    getFogColor(partialTicks) {
        let angle = this.getCelestialAngle(partialTicks);
        let rotation = Math.cos(angle * Math.PI * 2.0) * 2.0 + 0.5;
        rotation = MathHelper.clamp(rotation, 0.0, 1.0);

        let x = 0.7529412;
        let y = 0.84705883;
        let z = 1.0;

        x = x * (rotation * 0.94 + 0.06);
        y = y * (rotation * 0.94 + 0.06);
        z = z * (rotation * 0.91 + 0.09);

        return new Vector3(x, y, z);
    }

    getSunriseSunsetColor(partialTicks) {
        let angle = this.getCelestialAngle(partialTicks);
        let rotation = Math.cos(angle * Math.PI * 2.0);

        let min = 0;
        let max = 0.4;

        // Check if rotation is inside of sunrise or sunset
        if (rotation >= -max && rotation <= max) {
            let factor = ((rotation - min) / max) * 0.5 + 0.5;
            let strength = Math.pow(1.0 - (1.0 - Math.sin(factor * Math.PI)) * 0.99, 2);

            // Calculate colors for sunrise and sunset
            return new Vector4(
                factor * 0.3 + 0.7,
                factor * factor * 0.7 + 0.2,
                0.2,
                strength
            );
        } else {
            return null;
        }
    }

    getStarBrightness(partialTicks) {
        let angle = this.getCelestialAngle(partialTicks);
        let rotation = 1.0 - (Math.cos(angle * Math.PI * 2.0) * 2.0 + 0.75);
        rotation = MathHelper.clamp(rotation, 0.0, 1.0);
        return rotation * rotation * 0.5;
    }

    getLightBrightnessForEntity(entity) {
        let level = this.getTotalLightAt(Math.floor(entity.x), Math.floor(entity.y), Math.floor(entity.z));
        return Math.max(level / 15, 0.1);
    }

    getLightBrightness(x, y, z) {
        let level = this.getTotalLightAt(x, y, z);
        return Math.max(level / 15, 0.1);
    }

    getSkyColorByTemp(temperature) {
        temperature /= 3;
        if (temperature < -1) {
            temperature = -1;
        }
        if (temperature > 1.0) {
            temperature = 1.0;
        }
        return MathHelper.hsbToRgb(0.6222222 - temperature * 0.05, 0.5 + temperature * 0.1, 1.0);
    }

    calculateSkylightSubtracted(partialTicks) {
        let angle = this.getCelestialAngle(partialTicks);
        let level = 1.0 - (Math.cos(angle * 3.141593 * 2.0) * 2.0 + 0.5);
        if (level < 0.0) {
            level = 0.0;
        }
        if (level > 1.0) {
            level = 1.0;
        }
        return Math.floor(level * 11);
    }

    addEntity(entity) {
        // Check if entity with same ID already exists
        let existing = this.getEntityById(entity.id);
        if (existing !== null) {
            console.warn(`Entity with ID ${entity.id} already exists, removing old entity`);
            this.removeEntityById(entity.id);
        }
        
        this.entities.push(entity);
        try {
            entity.initRenderer();
            this.group.add(entity.renderer.group);
        } catch (e) {
            console.error(`Failed to initialize renderer for entity ${entity.id}:`, e);
            this.entities.pop();
        }
    }

    removeEntityById(id) {
        let entity = this.getEntityById(id);
        if (entity !== null) {
            let index = this.entities.indexOf(entity);
            if (index !== -1) {
                this.entities.splice(index, 1);
            }
            if (entity.renderer && entity.renderer.group) {
                this.group.remove(entity.renderer.group);
            }
        }
    }

    getEntityById(id) {
        for (let entity of this.entities) {
            if (entity && entity.id === id) {
                return entity;
            }
        }
        return null;
    }

    getSpawn() {
        return this.spawn;
    }

    setSpawn(x, z) {
        let y = this.getHeightAt(x, z);
        this.spawn = new Vector3(x, y + 8, z);
    }

    loadSpawnChunks() {
        let viewDistance = this.minecraft.settings.viewDistance;
        for (let x = -viewDistance; x <= viewDistance; x++) {
            for (let z = -viewDistance; z <= viewDistance; z++) {
                this.getChunkAt(x + this.spawn.x >> 4, z + this.spawn.z >> 4);
            }
        }
        this.spawn.y = this.getHeightAt(this.spawn.x, this.spawn.z) + 8;
    }

    getChunkProvider() {
        return this.chunkProvider;
    }

    clearChunks() {
        if (this.chunkProvider !== null) {
            this.chunkProvider.clearChunks();
        }
    }

    clearEntities() {
        for (let entity of this.entities) {
            this.removeEntityById(entity.id);
        }
    }

}