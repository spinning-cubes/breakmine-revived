const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Logger = require('./logger');
const log = Logger;

const WORLDS_DIR = path.join(__dirname, 'worlds');
const DEFAULT_WORLD_FILE = path.join(__dirname, 'world_data.bin');
const CURRENT_WORLD_FILE = path.join(__dirname, 'current_world.txt');

// Ensure worlds directory exists
if (!fs.existsSync(WORLDS_DIR)) {
    fs.mkdirSync(WORLDS_DIR, { recursive: true });
}

const worldChanges = new Map();
const blockInventories = new Map();
let currentWorldName = 'main';
let worldTime = 0; // In-game time (0-24000 ticks)

function getWorldFile(worldName) {
    if (worldName === 'main') {
        return DEFAULT_WORLD_FILE;
    }
    const sanitized = worldName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return path.join(WORLDS_DIR, `${sanitized}_data.bin`);
}

function migrateOldWorld(worldName) {
    const worldFile = getWorldFile(worldName);
    if (fs.existsSync(worldFile)) return false;

    const oldBin = worldName === 'main'
        ? path.join(__dirname, 'world.bin')
        : path.join(WORLDS_DIR, `${worldName}.bin`);

    if (fs.existsSync(oldBin)) {
        log.info('World', `Migrating ${oldBin} to ${worldFile}`);
        fs.renameSync(oldBin, worldFile);

        const oldChests = worldFile.replace('_data.bin', '.chests.json');
        if (fs.existsSync(oldChests)) {
            const chestsData = JSON.parse(fs.readFileSync(oldChests, 'utf8'));
            if (Array.isArray(chestsData)) {
                blockInventories.clear();
                for (const entry of chestsData) {
                    if (entry && entry.key) {
                        blockInventories.set(entry.key, entry.state || entry.inventory || null);
                    }
                }
            }
            fs.unlinkSync(oldChests);
        }
        return true;
    }
    return false;
}

function initWorld(worldName = 'main') {
    // Clear current world data
    worldChanges.clear();
    blockInventories.clear();
    currentWorldName = worldName;

    // Save current world name to file
    fs.writeFileSync(CURRENT_WORLD_FILE, worldName);

    const worldFile = getWorldFile(worldName);

    migrateOldWorld(worldName);

    if (fs.existsSync(worldFile)) {
        log.info('World', `Loading world (${worldName})...`);
        const data = fs.readFileSync(worldFile);
        let offset = 0;

        // Check if file has world time (new format) or not (old format)
        // Old format: numChanges(4) + changes*(11) -> (length - 4) % 11 === 0
        // New format: worldTime(8) + numChanges(4) + changes*(11) -> (length - 4) % 11 === 8
        const hasWorldTime = (data.length - 4) % 11 !== 0;

        if (hasWorldTime && data.length >= 8) {
            // Read world time (new format)
            worldTime = Number(data.readBigInt64BE(offset));
            offset += 8;
        } else {
            // Old format, no world time
            worldTime = 0;
        }

        if (data.length >= offset + 4) {
            let totalChanges = data.readUInt32BE(offset);
            offset += 4;

            // Validate that we have enough data for the declared number of changes
            const expectedDataSize = offset + (totalChanges * 11);
            if (data.length < expectedDataSize) {
                log.warn('World', `World file corrupted or incomplete. Expected ${expectedDataSize} bytes, got ${data.length}`);
                totalChanges = Math.floor((data.length - offset) / 11);
            }

            for (let i = 0; i < totalChanges; i++) {
                if (offset + 11 > data.length) {
                    log.warn('World', `Unexpected end of world file while reading changes`);
                    break;
                }
                const x = data.readInt32BE(offset);
                const y = data.readUInt8(offset + 4);
                const z = data.readInt32BE(offset + 5);
                let blockState = data.readUInt16BE(offset + 9);

                // Convert old format (blockId only) to new format (blockState)
                if (!hasWorldTime) {
                    // Old format stored just blockId, convert to blockState (blockId << 4)
                    blockState = (blockState & 0xFF) << 4;
                }

                worldChanges.set(`${x},${y},${z}`, blockState);
                offset += 11;
            }
        }

        // Read block inventories from binary file (if present)
        if (offset + 4 <= data.length) {
            const numInventories = data.readUInt32BE(offset);
            offset += 4;

            for (let i = 0; i < numInventories; i++) {
                if (offset + 2 > data.length) break;
                const keyLength = data.readUInt16BE(offset);
                offset += 2;

                if (offset + keyLength + 4 > data.length) break;
                const key = data.toString('utf8', offset, offset + keyLength);
                offset += keyLength;

                const stateLength = data.readUInt32BE(offset);
                offset += 4;

                if (offset + stateLength > data.length) break;
                const stateStr = data.toString('utf8', offset, offset + stateLength);
                offset += stateLength;

                try {
                    const state = JSON.parse(stateStr);
                    blockInventories.set(key, state);
                } catch (e) {
                    log.warn('World', `Failed to parse inventory state for ${key}: ${e.message}`);
                }
            }
        }

        log.info('World', `Finished loading world (${worldName})`);
    } else {
        log.info('World', `Creating new world (${worldName})...`);
        worldTime = 0; // Reset time for new world
    }
}

function loadCurrentWorld() {
    if (fs.existsSync(CURRENT_WORLD_FILE)) {
        try {
            const worldName = fs.readFileSync(CURRENT_WORLD_FILE, 'utf8').trim();
            if (worldName) {
                return worldName;
            }
        } catch (e) {
            log.warn('World', `Failed to load current world: ${e.message}`);
        }
    }
    return 'main';
}

function saveWorld() {
    const worldFile = getWorldFile(currentWorldName);

    // Serialize block inventories
    const inventoryEntries = [];
    for (const [key, state] of blockInventories.entries()) {
        const stateBuffer = Buffer.from(JSON.stringify(state), 'utf8');
        const keyBuffer = Buffer.from(key, 'utf8');
        inventoryEntries.push({ keyBuffer, stateBuffer });
    }

    // Calculate total buffer size
    let totalSize = 8 + 4 + (worldChanges.size * 11) + 4; // header + changes + numInventories
    for (const entry of inventoryEntries) {
        totalSize += 2 + entry.keyBuffer.length + 4 + entry.stateBuffer.length;
    }

    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Write world time
    buffer.writeBigInt64BE(BigInt(worldTime), offset);
    offset += 8;

    // Write number of block changes
    buffer.writeUInt32BE(worldChanges.size, offset);
    offset += 4;

    // Write block changes
    for (const [coords, blockState] of worldChanges.entries()) {
        const [x, y, z] = coords.split(',').map(Number);
        buffer.writeInt32BE(x, offset);
        buffer.writeUInt8(y, offset + 4);
        buffer.writeInt32BE(z, offset + 5);
        buffer.writeUInt16BE(blockState, offset + 9);
        offset += 11;
    }

    // Write block inventories
    buffer.writeUInt32BE(inventoryEntries.length, offset);
    offset += 4;

    for (const entry of inventoryEntries) {
        buffer.writeUInt16BE(entry.keyBuffer.length, offset);
        offset += 2;
        entry.keyBuffer.copy(buffer, offset);
        offset += entry.keyBuffer.length;
        buffer.writeUInt32BE(entry.stateBuffer.length, offset);
        offset += 4;
        entry.stateBuffer.copy(buffer, offset);
        offset += entry.stateBuffer.length;
    }

    fs.writeFileSync(worldFile, buffer);
    //log.info('World', `World saved (${currentWorldName})`);
}

function addWorldChange(x, y, z, blockId, metadata = 0) {
    const blockState = (blockId << 4) | (metadata & 0xF);
    worldChanges.set(`${x},${y},${z}`, blockState);
}

function getWorldChanges() {
    return worldChanges;
}

// Base flat-world terrain used for positions that were never changed. Must
// mirror generateFlatChunkColumn so server-side block logic (bluestone
// simulation, etc.) sees the same world as clients.
function getBaseBlock(worldY) {
    if (worldY === 0) return 7;        // Bedrock
    if (worldY >= 1 && worldY <= 7) return 1; // Stone
    if (worldY === 8) return 3;        // Dirt
    if (worldY === 9) return 2;        // Grass
    return 0;                          // Air
}

function getBlockAt(x, y, z) {
    const key = `${x},${y},${z}`;
    const blockState = worldChanges.get(key);
    return blockState !== undefined ? (blockState >> 4) : getBaseBlock(y);
}

function getBlockMetadata(x, y, z) {
    const key = `${x},${y},${z}`;
    const blockState = worldChanges.get(key);
    return blockState !== undefined ? (blockState & 0xF) : 0;
}

function getBlockInventories() {
    return blockInventories;
}

function setBlockInventory(key, state) {
    const existing = blockInventories.get(key);
    if (existing && typeof existing === 'object' && existing.items !== undefined) {
        existing.size = state.size || existing.size;
        if (Array.isArray(state.items)) {
            existing.items = state.items;
        }
        blockInventories.set(key, existing);
    } else {
        blockInventories.set(key, state);
    }
}

function getBlockInventory(key) {
    return blockInventories.get(key);
}

function getAllBlockInventoriesState() {
    return Array.from(blockInventories.entries()).map(([key, state]) => ({ key, state }));
}

function getCurrentWorldName() {
    return currentWorldName;
}

function listWorlds() {
    const worlds = ['main']; // Always include main

    if (fs.existsSync(WORLDS_DIR)) {
        const files = fs.readdirSync(WORLDS_DIR);
        files.forEach(file => {
            if (file.endsWith('_data.bin')) {
                const worldName = file.replace('_data.bin', '');
                worlds.push(worldName);
            }
        });
    }

    return worlds;
}

function getWorldTime() {
    return worldTime;
}

function setWorldTime(time) {
    worldTime = time;
}

function deleteBlockInventory(key) {
    blockInventories.delete(key);
}

function tickWorldTime() {
    worldTime = (worldTime + 1) % 24000;
}

function generateFlatChunkColumn(chunkX, chunkZ, worldChanges) {
    const SECTION_COUNT = 16;
    const BLOCK_STATE_SIZE = 4096 * 2;
    const NIBBLE_SIZE = 2048;
    const BIOME_SIZE = 256;

    const sectionSize = BLOCK_STATE_SIZE + NIBBLE_SIZE + NIBBLE_SIZE;
    const buffer = Buffer.alloc(sectionSize * SECTION_COUNT + BIOME_SIZE);

    for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex++) {
        const sectionOffset = sectionIndex * sectionSize;
        const baseY = sectionIndex * 16;

        for (let y = 0; y < 16; y++) {
            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    const localIndex = ((y << 8) | (z << 4) | x) * 2;
                    const worldY = baseY + y;
                    const worldX = chunkX * 16 + x;
                    const worldZ = chunkZ * 16 + z;
                    const key = `${worldX},${worldY},${worldZ}`;
                    let blockState = worldChanges.get(key);

                    if (blockState === undefined) {
                        let blockId;
                        if (worldY === 0) {
                            blockId = 7; // Bedrock
                        } else if (worldY >= 1 && worldY <= 7) {
                            blockId = 1; // Stone
                        } else if (worldY === 8) {
                            blockId = 3; // Dirt
                        } else if (worldY === 9) {
                            blockId = 2; // Grass
                        } else {
                            blockId = 0; // Air
                        }
                        const metadata = 0;
                        blockState = (blockId << 4) | (metadata & 0xF);
                    }

                    buffer.writeUInt16LE(blockState, sectionOffset + localIndex);
                }
            }
        }

        const lightOffset = sectionOffset + BLOCK_STATE_SIZE;
        buffer.fill(0xFF, lightOffset, lightOffset + NIBBLE_SIZE);
        buffer.fill(0xFF, lightOffset + NIBBLE_SIZE, lightOffset + NIBBLE_SIZE * 2);
    }

    buffer.fill(1, sectionSize * SECTION_COUNT);

    return buffer;
}

module.exports = {
    initWorld,
    saveWorld,
    addWorldChange,
    getWorldChanges,
    getBlockInventories,
    setBlockInventory,
    getBlockInventory,
    getAllBlockInventoriesState,
    getBlockAt,
    getBlockMetadata,
    generateFlatChunkColumn,
    getCurrentWorldName,
    listWorlds,
    getWorldTime,
    setWorldTime,
    tickWorldTime,
    loadCurrentWorld,
    deleteBlockInventory
};