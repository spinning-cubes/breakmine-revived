// Direction offsets for 6 faces (used to fake light passing through non-AO blocks)
const FACE_DX = [1, -1, 0, 0, 0, 0];
const FACE_DY = [0, 0, 1, -1, 0, 0];
const FACE_DZ = [0, 0, 0, 0, 1, -1];

import EnumBlockFace from "../../util/EnumBlockFace.js";
import BlockRenderType from "../../util/BlockRenderType.js";
import Tessellator from "./Tessellator.js";
import MathHelper from "../../util/MathHelper.js";
import Block from "../world/block/Block.js";
import BoundingBox from "../../util/BoundingBox.js";
import { BlockRegistry } from "../world/block/BlockRegistry.js";
import BlockWire from "../world/block/type/BlockWire.js";

export default class BlockRenderer {

    constructor(worldRenderer) {
        this.worldRenderer = worldRenderer;
        this.tessellator = new Tessellator();
        // Bind to texture atlas if available, otherwise fallback to terrain texture
        if (worldRenderer.textureAtlas && worldRenderer.textureAtlas.isLoaded()) {
            this.tessellator.bindTexture(worldRenderer.textureAtlas.getTexture());
        } else {
            this.tessellator.bindTexture(worldRenderer.textureTerrain);
        }
    }

    renderBlock(world, block, ambientOcclusion, x, y, z) {
        if (block.path) {
            this.renderPath(world, block, ambientOcclusion, x, y, z);
            return;
        } else if (block.multipart === true) {
            this.renderMultipart(world, block, x, y, z);
            return;
        } else if (block && block.getId() === BlockRegistry.WIRE.getId()) {
            this.renderWire(world, block, x, y, z);
            return;
        }

        switch (block.getRenderType()) {
            case BlockRenderType.BLOCK:
                this.renderSolidBlock(world, block, ambientOcclusion, x, y, z);
                break;
            case BlockRenderType.ITEM:
                this.renderSolidBlock(world, block, ambientOcclusion, x, y, z);
                break;
            case BlockRenderType.TORCH:
                this.renderTorch(world, block, x, y, z);
                break;
        }
    }

    renderFakeBlock(world, blockId, ambientOcclusion, x, y, z, minX, minY, minZ, maxX, maxY, maxZ) {
        let boundingBox = new BoundingBox(minX, minY, minZ, maxX, maxY, maxZ);
        let block = Block.getById(blockId);
        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            this.renderFace(world, block, boundingBox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
        }
    }

    renderFakeBlockWithBlockClass(world, block, ambientOcclusion, x, y, z, minX, minY, minZ, maxX, maxY, maxZ) {
        let boundingBox = new BoundingBox(minX, minY, minZ, maxX, maxY, maxZ);
        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            this.renderFace(world, block, boundingBox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
        }
    }

    renderFakeBlockWithBlockClassWithBoundingBox(world, block, ambientOcclusion, x, y, z, boundingBox) {
        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            this.renderFace(world, block, boundingBox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
        }
    }

    renderFakeBlockWithBoundingBox(world, blockId, ambientOcclusion, x, y, z, bbox) {
        let block = Block.getById(blockId);
        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            this.renderFace(world, block, bbox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
        }
    }

    renderMultipart(world, block, x, y, z) {
        const gotMultipart = block.getMultipart(world, x, y, z);
        for (let i = 0; i < gotMultipart.length; i++) {
            let partBlock = null;
            let bbox = null;
            
            if (gotMultipart[i][0] === 'block') {
                partBlock = Block.getById(gotMultipart[i][1]);
                bbox = gotMultipart[i][2];
            } else if (gotMultipart[i][0] === 'blockClass') {
                partBlock = gotMultipart[i][2]['block'];
                bbox = gotMultipart[i][2]['bbox'];
            }
            
            if (partBlock && bbox) {
                let values = EnumBlockFace.values();
                for (let j = 0; j < values.length; j++) {
                    this.renderFace(world, partBlock, bbox, values[j], false, x, y, z);
                }
            }
        }
    }

    renderSolidBlock(world, block, ambientOcclusion, x, y, z) {
        let boundingBox = block.getBoundingBox(world, x, y, z);

        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            let neighborBlock = world ? Block.getById(world.getBlockAtFace(x, y, z, face)) : null;

            if (world === null || block.shouldRenderFace(world, x, y, z, face) || (neighborBlock !== null && (neighborBlock.path === true || neighborBlock.noFaceCull === true || neighborBlock.multipart === true))) {
                this.renderFace(world, block, boundingBox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
            }
        }
    }

    renderPath(world, block, ambientOcclusion, x, y, z) {
        let boundingBox = new BoundingBox(0, 0, 0, 1, 1 - (1/16), 1);

        let values = EnumBlockFace.values();
        for (let i = 0; i < values.length; i++) {
            let face = values[i];
            let neighborBlock = world ? Block.getById(world.getBlockAtFace(x, y, z, face)) : null;

            if (world === null || block.shouldRenderFace(world, x, y, z, face) || (neighborBlock !== null && (neighborBlock.path === true || neighborBlock.noFaceCull === true || neighborBlock.multipart === true))) {
                this.renderFace(world, block, boundingBox, face, block.getAmbientOcclusion() && ambientOcclusion, x, y, z);
            }
        }
    }

    renderWire(world, block, x, y, z) {
        if (world === null) {
            // Render a simple flat square for the inventory/hand view
            let wireThickness = 4 / 16;
            let centerBox = {
                minX: 0.5 - wireThickness, minY: 0, minZ: 0.5 - wireThickness, 
                maxX: 0.5 + wireThickness, maxY: 0.001, maxZ: 0.5 + wireThickness
            };
            this.renderFace(world, block, centerBox, EnumBlockFace.TOP, false, x, y, z); 
            return;
        }

        let power = 0;
        if (world !== null) {
            // Read the power level from the block state (0-15)
            //power = world.getBlockstateAt(x, y, z); 
        }
        
        let wireThickness = 2 / 16; // 2/16ths of a block for width
        let wireHeight = 1 / 16;   // Place wire low on the block

        let center_minX = x + 0.5 - wireThickness;
        let center_maxX = x + 0.5 + wireThickness;
        let center_minY = y + wireHeight;
        let center_maxY = y + wireHeight + 0.001; // Tiny height
        let center_minZ = z + 0.5 - wireThickness;
        let center_maxZ = z + 0.5 + wireThickness;
        
        // Render the top face of the central block
        // Bounding box must be relative to the block (x=0, y=0, z=0)
        let centerBox = {
            minX: center_minX - x, minY: center_minY - y, minZ: center_minZ - z, 
            maxX: center_maxX - x, maxY: center_maxY - y, maxZ: center_maxZ - z
        };
        
        // Renders a small square in the middle
        this.renderFace(world, block, centerBox, EnumBlockFace.TOP, false, x, y, z); 

        const connectionMap = [
            { dx: 0, dz: -1, face: EnumBlockFace.NORTH },
            { dx: 0, dz: 1, face: EnumBlockFace.SOUTH },
            { dx: -1, dz: 0, face: EnumBlockFace.WEST },
            { dx: 1, dz: 0, face: EnumBlockFace.EAST },
        ];

        for (const { dx, dz, face } of connectionMap) {
            let neighborId = world.getBlockAt(x + dx, y, z + dz);
            
            // Check if connection is valid using the helper in BlockWire
            if (BlockWire.canWireConnectTo(neighborId)) {
                
                let line_minX, line_minZ, line_maxX, line_maxZ;
                let armStart = wireThickness;

                if (dx !== 0) { // West/East (X-axis)
                    // Z-bounds are determined by the thickness of the center dot
                    line_minZ = z + 0.5 - wireThickness;
                    line_maxZ = z + 0.5 + wireThickness; 
                    
                    if (dx < 0) { // WEST (from x to x + armStart)
                        line_minX = x;
                        line_maxX = x + 0.5 - wireThickness;
                    } else { // EAST (from x + 1 - armStart to x + 1)
                        line_minX = x + 0.5 + wireThickness;
                        line_maxX = x + 1.0;
                    }

                } else if (dz !== 0) { // North/South (Z-axis)
                    // X-bounds are determined by the thickness of the center dot
                    line_minX = x + 0.5 - wireThickness;
                    line_maxX = x + 0.5 + wireThickness;
                    
                    if (dz < 0) { // NORTH (from z to z + armStart)
                        line_minZ = z;
                        line_maxZ = z + 0.5 - wireThickness;
                    } else { // SOUTH (from z + 1 - armStart to z + 1)
                        line_minZ = z + 0.5 + wireThickness;
                        line_maxZ = z + 1.0;
                    }
                }
                
                // Render the top face of the connection line
                let lineBox = {
                    minX: line_minX - x, minY: center_minY - y, minZ: line_minZ - z, 
                    maxX: line_maxX - x, maxY: center_maxY - y, maxZ: line_maxZ - z
                };
                this.renderFace(world, block, lineBox, EnumBlockFace.TOP, false, x, y, z);
            }
        }
    }

    renderFace(world, block, boundingBox, face, ambientOcclusion, x, y, z) {
        let chunkX = x >> 4;
        let chunkY = y >> 4;
        let chunkZ = z >> 4;

        let blockData = 0;
        if (world) {
            let chunk = world.getChunkAt(chunkX, chunkZ);
            if (chunk) {
                blockData = chunk.getBlockDataAt(x & 15, y, z & 15);
            }
        }

        let minX = x + boundingBox.minX;
        let minY = y + boundingBox.minY;
        let minZ = z + boundingBox.minZ;
        let maxX = x + boundingBox.maxX;
        let maxY = y + boundingBox.maxY;
        let maxZ = z + boundingBox.maxZ;

        let minU, minV;
        let maxU, maxV;
        
        if (this.worldRenderer.textureAtlas && this.worldRenderer.textureAtlas.isLoaded()) {
            let textureName = block.getTextureForFace(face, blockData, x, y, z, world);
            let uvs = this.worldRenderer.textureAtlas.getUVs(textureName);
            minU = uvs.minU;
            maxU = uvs.maxU;
            minV = uvs.minV;
            maxV = uvs.maxV;
        } else {
            let textureIndex = block.getTextureForFace(face, blockData, x, y, z, world);
            minU = (textureIndex % 16) / 16.0;
            maxU = minU + (16 / 256);
            minV = Math.floor(textureIndex / 16) / 16.0;
            maxV = minV + (16 / 256);
        }
        
        let width = boundingBox.maxX - boundingBox.minX;
        let height = boundingBox.maxY - boundingBox.minY;
        let depth = boundingBox.maxZ - boundingBox.minZ;

        switch (face) {
            case EnumBlockFace.BOTTOM:
            case EnumBlockFace.TOP:
                maxU = minU + (16 / 256 * width);
                maxV = minV + (16 / 256 * depth);
                break;
            case EnumBlockFace.NORTH:
            case EnumBlockFace.SOUTH:
                maxU = minU + (16 / 256 * width);
                maxV = minV + (16 / 256 * height);
                
                if (height < 1.0 && block?.topAlign !== true) {
                    let vOffset = (16 / 256) * (1.0 - height);
                    minV += vOffset;
                    maxV += vOffset;
                }
                break;
            case EnumBlockFace.WEST:
            case EnumBlockFace.EAST:
                maxU = minU + (16 / 256 * depth);
                maxV = minV + (16 / 256 * height);

                if (height < 1.0 && block?.topAlign !== true) {
                    let vOffset = (16 / 256) * (1.0 - height);
                    minV += vOffset;
                    maxV += vOffset;
                }
                break;
        }

        minV = 1 - minV;
        maxV = 1 - maxV;

        let color = block.getColor(world, x, y, z, face);
        let red = (color >> 16 & 255) / 255.0;
        let green = (color >> 8 & 255) / 255.0;
        let blue = (color & 255) / 255.0;

        // Classic lightning
        if (!ambientOcclusion) {
            // Use effective light level to prevent black faces next to non-AO blocks like fences
            let level = world === null ? 15 : this.getEffectiveLightLevel(world, minX + face.x, minY + face.y, minZ + face.z);
            let brightness = 0.9 / 15.0 * level + 0.1;
            let shade = brightness * face.getShading();
            this.tessellator.setColor(red * shade, green * shade, blue * shade);
        }

        this.addFace(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, red, green, blue);
    }

    addFace(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, red = 1, green = 1, blue = 1) {
        if (face === EnumBlockFace.BOTTOM) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, maxZ, maxU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, minZ, maxU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, minU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, maxZ, minU, maxV, red, green, blue);
        }
        if (face === EnumBlockFace.TOP) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, maxZ, minU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, minZ, minU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, minZ, maxU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, maxZ, maxU, maxV, red, green, blue);
        }
        if (face === EnumBlockFace.NORTH) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, minZ, maxU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, maxU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, minZ, minU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, minZ, minU, minV, red, green, blue);
        }
        if (face === EnumBlockFace.SOUTH) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, maxZ, minU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, maxZ, maxU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, maxZ, maxU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, maxZ, minU, maxV, red, green, blue);
        }
        if (face === EnumBlockFace.WEST) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, maxZ, maxU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, minU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, minZ, minU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, maxZ, maxU, minV, red, green, blue);
        }
        if (face === EnumBlockFace.EAST) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, maxZ, minU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, minZ, maxU, minV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, minZ, maxU, maxV, red, green, blue);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, minY, maxZ, minU, maxV, red, green, blue);
        }
    }

    addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, x, y, z, u, v, red, green, blue) {
        if (ambientOcclusion) {
            this.setAverageBrightness(world, face, x, y, z, red, green, blue);
        }

        this.tessellator.addVertexWithUV(x - (chunkX << 4), y - (chunkY << 4), z - (chunkZ << 4), u, v);
    }

    setAverageBrightness(world, face, x, y, z, red = 1, green = 1, blue = 1) {
        let lightLevelAtThisCorner = this.getAverageLightLevelAt(world, x, y, z);

        let brightness = 0.9 / 15.0 * lightLevelAtThisCorner + 0.1;
        let shading = brightness * face.getShading();

        this.tessellator.setColor(red * shading, green * shading, blue * shading);
    }

    getEffectiveLightLevel(world, x, y, z) {
        if (world === null) return 15;
        
        let typeId = world.getBlockAt(x, y, z);
        let block = !typeId ? null : Block.getById(typeId);

        // Air or translucent blocks let light pass normally
        if (!block || block.isTranslucent()) {
            return world.getTotalLightAt(x, y, z);
        } 
        
        // Blocks that don't cast AO (like fences) block the light engine, 
        // so their internal light is 0. We fake it by checking neighbors.
        if (!block.canCastAmbientOcclusion()) {
            let maxSurroundingLight = 0;
            for (let i = 0; i < 6; i++) {
                let light = world.getTotalLightAt(x + FACE_DX[i], y + FACE_DY[i], z + FACE_DZ[i]);
                if (light > maxSurroundingLight) {
                    maxSurroundingLight = light;
                }
            }
            return maxSurroundingLight;
        }

        // Solid blocks that cast AO
        return world.getTotalLightAt(x, y, z);
    }

    getAverageLightLevelAt(world, x, y, z) {
        if (world === null) {
            return 15;
        }

        let totalLightLevel = 0;
        let totalBlocks = 0;

        for (let offsetX = -1; offsetX <= 0; offsetX++) {
            for (let offsetY = -1; offsetY <= 0; offsetY++) {
                for (let offsetZ = -1; offsetZ <= 0; offsetZ++) {
                    let bx = x + offsetX;
                    let by = y + offsetY;
                    let bz = z + offsetZ;
                    
                    let typeId = world.getBlockAt(bx, by, bz);
                    let block = !typeId ? null : Block.getById(typeId);

                    if (!block || block.isTranslucent()) {
                        totalLightLevel += world.getTotalLightAt(bx, by, bz);
                        totalBlocks++;
                    } 
                    else if (!block.canCastAmbientOcclusion()) {
                        let maxSurroundingLight = 0;
                        for (let i = 0; i < 6; i++) {
                            let light = world.getTotalLightAt(bx + FACE_DX[i], by + FACE_DY[i], bz + FACE_DZ[i]);
                            if (light > maxSurroundingLight) {
                                maxSurroundingLight = light;
                            }
                        }
                        totalLightLevel += maxSurroundingLight;
                        totalBlocks++;
                    } 
                    else {
                        if (offsetY === 0) {
                            totalBlocks++;
                        }
                    }
                }
            }
        }

        return totalBlocks === 0 ? 0 : totalLightLevel / totalBlocks;
    }

    renderTorch(world, block, x, y, z) {
        let chunkX = x >> 4;
        let chunkY = y >> 4;
        let chunkZ = z >> 4;

        let size = 1 / 16;

        let distortX = 0;
        let distortZ = 0;

        if (world != null) {
            switch (world.getBlockDataAt(x, y, z)) {
                case 1:
                    distortX = -0.2;
                    break;
                case 2:
                    distortX = 0.2;
                    break;
                case 3:
                    distortZ = -0.2;
                    break;
                case 4:
                    distortZ = 0.2;
                    break;
            }
        }

        let centerX = 0.5 + distortX * 1.5;
        let centerZ = 0.5 + distortZ * 1.5;

        if (distortX !== 0 || distortZ !== 0) {
            y += 0.2;
        }

        let minX = x + centerX - size;
        let minY = y;
        let minZ = z + centerZ - size;
        let maxX = x + centerX + size;
        let maxY = y + 10 / 16;
        let maxZ = z + centerZ + size;

        let minU, minV, maxU, maxV;
        
        if (this.worldRenderer.textureAtlas && this.worldRenderer.textureAtlas.isLoaded()) {
            let textureName = block.getTextureForFace(EnumBlockFace.NORTH);
            let uvs = this.worldRenderer.textureAtlas.getUVs(textureName);
            let uOffset = 7 / 16;
            let vOffset = 6 / 16;
            let uSize = 2 / 16;
            let vSize = 10 / 16;
            
            minU = uvs.minU + uOffset * (uvs.maxU - uvs.minU);
            minV = uvs.minV + vOffset * (uvs.maxV - uvs.minV);
            maxU = minU + uSize * (uvs.maxU - uvs.minU);
            maxV = minV + vSize * (uvs.maxV - uvs.minV);
        } else {
            let textureIndex = block.getTextureForFace(EnumBlockFace.NORTH);
            minU = (textureIndex % 16) / 16.0;
            minV = Math.floor(textureIndex / 16) / 16.0;
            
            minU += 7 / 256;
            minV += 6 / 256;
            
            maxU = minU + 2 / 256;
            maxV = minV + 10 / 256;
        }

        minV = 1 - minV;
        maxV = 1 - maxV;

        this.tessellator.setColor(1, 1, 1);

        this.addDistortFace(world, EnumBlockFace.NORTH, false, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, distortX, distortZ);
        this.addDistortFace(world, EnumBlockFace.EAST, false, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, distortX, distortZ);
        this.addDistortFace(world, EnumBlockFace.SOUTH, false, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, distortX, distortZ);
        this.addDistortFace(world, EnumBlockFace.WEST, false, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, distortX, distortZ);
        this.addFace(world, EnumBlockFace.TOP, false, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV + 8 / 256);
    }

    addDistortFace(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV, distortX, distortZ) {
        if (face === EnumBlockFace.NORTH) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, minZ, minU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX + distortX, minY, minZ + distortZ, minU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX + distortX, minY, minZ + distortZ, maxU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, minZ, maxU, minV);
        }
        if (face === EnumBlockFace.SOUTH) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, maxZ, maxU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, maxZ, minU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX + distortX, minY, maxZ + distortZ, minU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX + distortX, minY, maxZ + distortZ, maxU, maxV);
        }
        if (face === EnumBlockFace.WEST) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX + distortX, minY, maxZ + distortZ, minU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX + distortX, minY, minZ + distortZ, maxU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, minZ, maxU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, minX, maxY, maxZ, minU, minV);
        }
        if (face === EnumBlockFace.EAST) {
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, maxZ, maxU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX, maxY, minZ, minU, minV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX + distortX, minY, minZ + distortZ, minU, maxV);
            this.addBlockCorner(world, face, ambientOcclusion, chunkX, chunkY, chunkZ, maxX + distortX, minY, maxZ + distortZ, maxU, maxV);
        }
    }

    renderBlockInHandThirdPerson(group, block, brightness) {
        this.tessellator.startDrawing();
        this.renderBlock(null, block, false, 0, 0, 0);
        this.tessellator.transformBrightness(brightness);
        let mesh = this.tessellator.draw(group);
        mesh.geometry.center();
        mesh.position.x = 0;
        mesh.position.y = 9;
        mesh.position.z = -5;
        mesh.rotation.y = Math.PI / 4;
        mesh.scale.x = 6;
        mesh.scale.y = -6;
        mesh.scale.z = 6;
    }

    renderBlockInFirstPerson(group, block, brightness) {
        this.tessellator.startDrawing();
        this.renderBlock(null, block, false, 0, 0, 0);
        this.tessellator.transformBrightness(brightness);
        let mesh = this.tessellator.draw(group);
        mesh.geometry.center();
        mesh.scale.x = 16;
        mesh.scale.y = 16;
        mesh.scale.z = 16;
        if (block.getRenderType() === BlockRenderType.ITEM) {
            mesh.position.y += 8;
            if (block.isTool === true) {
                mesh.rotation.x -= Math.PI / 2.5;
            }
        }
    }

    renderGuiBlock(group, block, x, y, size, brightness) {
        this.tessellator.startDrawing();
        this.tessellator.setColor(1, 1, 1);

        // Render block by type
        if (block.getId() === BlockRegistry.WIRE.getId()) {
            this.renderWire(null, block, 0, 0, 0);
            return;
        } else if (!block.path && block.multipart !== true) {
            switch (block.getRenderType()) {
                case BlockRenderType.BLOCK:
                    let boundingBox = block.getBoundingBox(null, 0, 0, 0);
                    this.renderFace(null, block, boundingBox, EnumBlockFace.TOP, false, 0, 0, 0);
                    this.renderFace(null, block, boundingBox, EnumBlockFace.NORTH, false, 0, 0, 0);
                    this.renderFace(null, block, boundingBox, EnumBlockFace.EAST, false, 0, 0, 0);
                    break;
                default:
                    this.renderGuiItem(block);
                    break;
            }
        } else if (block.multipart === true) {
            this.renderMultipart(null, block, 0, 0, 0);
        } else if (block.path) {
            this.renderPath(null, block, false, 0, 0, 0);
        }

        // Change brightness
        this.tessellator.transformBrightness(brightness);

        // Create mesh
        let mesh = this.tessellator.draw(group);
        mesh.geometry.center();

        // Rotate block
        if (block.multipart === true || block.path) {
            mesh.rotation.x = MathHelper.toRadians(45 / 1.5);
            mesh.rotation.y = -MathHelper.toRadians(45 + 90);
        } else {
            switch (block.getRenderType()) {
                case BlockRenderType.BLOCK:
                    mesh.rotation.x = MathHelper.toRadians(45 / 1.5);
                    mesh.rotation.y = -MathHelper.toRadians(45 + 90);
                    break;
                default:
                    mesh.rotation.y = MathHelper.toRadians(180);
                    size += 5;
                    break;
            }
        }

        // Relative position
        mesh.position.x = x;
        mesh.position.y = -y;
        mesh.position.z = -10;

        // Scale
        mesh.scale.x = size;
        mesh.scale.y = size;
        mesh.scale.z = size;
    }

    renderGuiItem(block) {
        let minX = 0;
        let minY = 0;
        let minZ = 0;
        let maxX = 1;
        let maxY = 1;
        let maxZ = 1;

        let offset = (1 / 256);

        let minU, maxU, minV, maxV;
        
        if (this.worldRenderer.textureAtlas && this.worldRenderer.textureAtlas.isLoaded()) {
            let textureName = block.getTextureForFace(EnumBlockFace.NORTH);
            let uvs = this.worldRenderer.textureAtlas.getUVs(textureName);
            minU = uvs.minU;
            maxU = uvs.maxU;
            minV = uvs.minV;
            maxV = uvs.maxV;
        } else {
            let textureIndex = block.getTextureForFace(EnumBlockFace.NORTH);
            minU = (textureIndex % 16) / 16.0;
            maxU = minU + (16 / 256);
            minV = Math.floor(textureIndex / 16) / 16.0;
            maxV = minV + (16 / 256);
        }

        minV = 1 - minV;
        maxV = 1 - maxV;

        minU += offset;
        maxU -= offset;
        minV -= offset;
        maxV += offset;

        this.addFace(null, EnumBlockFace.NORTH, false, 0, 0, 0, minX, minY, minZ, maxX, maxY, maxZ, minU, minV, maxU, maxV);
    }

    renderBlockInNullWorld(group, block, brightness) {
        this.tessellator.startDrawing();
        this.renderBlock(null, block, false, 0, 0, 0);
        this.tessellator.transformBrightness(brightness);
        let mesh = this.tessellator.draw(group);
        mesh.geometry.center();
        return mesh;
    }
}