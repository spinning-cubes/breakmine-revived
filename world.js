const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Logger = require('./logger');
const log = Logger;

const WORLDS_DIR = path.join(__dirname, 'worlds');
const DEFAULT_WORLD_FILE = path.join(__dirname, 'world.bin');
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
    return path.join(WORLDS_DIR, `${sanitized}.bin`);
}

function getBlockInventoryFile(worldName) {
    const worldFile = getWorldFile(worldName);
    return worldFile.replace(/\.bin$/i, '.chests.json');
}

function loadBlockInventories(worldName = currentWorldName) {
    const inventoryFile = getBlockInventoryFile(worldName);
    if (!fs.existsSync(inventoryFile)) {
        return;
    }

    try {
        const raw = fs.readFileSync(inventoryFile, 'utf8');
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) {
            return;
        }

        blockInventories.clear();
        for (const entry of entries) {
            if (!entry || typeof entry !== 'object' || !entry.key) {
                continue;
            }
            blockInventories.set(entry.key, entry.state || entry.inventory || null);
        }
    } catch (e) {
        log.warn('World', `Failed to load block inventories (${worldName}): ${e.message}`);
    }
}

function saveBlockInventories() {
    const inventoryFile = getBlockInventoryFile(currentWorldName);
    const entries = Array.from(blockInventories.entries()).map(([key, state]) => ({
        key,
        state
    }));
    fs.writeFileSync(inventoryFile, JSON.stringify(entries, null, 2));
}

function initWorld(worldName = 'main') {
    // Clear current world data
    worldChanges.clear();
    blockInventories.clear();
    currentWorldName = worldName;

    // Save current world name to file
    fs.writeFileSync(CURRENT_WORLD_FILE, worldName);

    const worldFile = getWorldFile(worldName);

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
        loadBlockInventories(worldName);
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
    // Format: worldTime(8) + numChanges(4) + changes*(11)
    const buffer = Buffer.alloc(8 + 4 + (worldChanges.size * 11));
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
    fs.writeFileSync(worldFile, buffer);
    saveBlockInventories();
    //log.info('World', `World saved (${currentWorldName})`);
}

function addWorldChange(x, y, z, blockId, metadata = 0) {
    const blockState = (blockId << 4) | (metadata & 0xF);
    worldChanges.set(`${x},${y},${z}`, blockState);
}

function getWorldChanges() {
    return worldChanges;
}

function getBlockAt(x, y, z) {
    const key = `${x},${y},${z}`;
    const blockState = worldChanges.get(key);
    return blockState !== undefined ? (blockState >> 4) : 0;
}

function getBlockMetadata(x, y, z) {
    const key = `${x},${y},${z}`;
    const blockState = worldChanges.get(key);
    return blockState !== undefined ? (blockState & 0xF) : 0;
}

function setBlockInventory(key, state) {
    blockInventories.set(key, state);
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
            if (file.endsWith('.bin')) {
                const worldName = file.replace('.bin', '');
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
    loadCurrentWorld
};