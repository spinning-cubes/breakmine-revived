// Server-side world generation.
//
// The server is authoritative for multiplayer terrain: clients render exactly
// what the server sends (ChunkProviderClient has no local generator). This
// module reuses the *same* generator classes the client uses for single-player
// worlds (src/js/net/minecraft/client/world/generator/WorldGenerator.js) so
// server terrain matches what the client would generate for the same
// seed/world type.
//
// Supported world types:
//   flat     - classic flat layer (bedrock, stone, dirt, grass). Seed ignored.
//   normal   - noise-based rolling terrain with caves, ores, bedrock.
//   amplified - normal terrain with taller, steeper mountains.
//
// The seed may be a number, a signed long string (e.g. "-5529091579467429620")
// or a non-numeric string (hashed like the client's create-world screen).
'use strict';

const config = require('../config');
const { BlockRegistry } = require('../src/js/net/minecraft/client/world/block/BlockRegistry.js');

let WorldGeneratorClass = null;
let PrimerClass = null;
let RandomClass = null;
let Long = null;

try {
    WorldGeneratorClass = require('../src/js/net/minecraft/client/world/generator/WorldGenerator.js').default;
    PrimerClass = require('../src/js/net/minecraft/client/world/generator/Primer.js').default;
    RandomClass = require('../src/js/net/minecraft/util/Random.js').default;
    Long = require('../libraries/long.js').default;
} catch (e) {
    console.error('[WorldGen] Failed to load client generator classes:', e.message);
}

const VALID_TYPES = ['flat', 'normal', 'amplified'];

// Chunk section layout (must stay in sync with what packets.js sends):
// 16 sections x (4096 block states * 2 bytes + 2048 block light + 2048 sky
// light) followed by 256 biome bytes.
const SECTION_COUNT = 16;
const BLOCK_STATE_SIZE = 4096 * 2;
const NIBBLE_SIZE = 2048;
const SECTION_SIZE = BLOCK_STATE_SIZE + NIBBLE_SIZE + NIBBLE_SIZE;

function normalizeWorldType(worldType) {
    const wt = String(worldType || 'flat').toLowerCase().trim();
    return VALID_TYPES.includes(wt) ? wt : 'flat';
}

function getWorldType() {
    return normalizeWorldType(config.worldType);
}

// Convert a serverconfig seed to the Long the client would derive for the
// same input (mirrors GuiCreateWorld.setSeed).
function seedToLong(seedText) {
    const seed = String(seedText);
    if (seed.length === 0) {
        return new RandomClass().nextLong();
    }
    if (isNaN(seed)) {
        let h = 0;
        for (let i = 0; i < seed.length; i++) {
            h = 31 * h + seed.charCodeAt(i);
        }
        return Long.fromNumber(h);
    }
    return Long.fromString(seed);
}

let cachedGenerator = null;
let cachedGeneratorKey = null;

function getGeneratorKey() {
    return getWorldType() + ':' + seedToLong(config.seed).toString();
}

function getGenerator() {
    if (!WorldGeneratorClass) return null;

    const worldType = getWorldType();
    const seedLong = seedToLong(config.seed);
    const key = worldType + ':' + seedLong.toString();

    if (cachedGenerator && cachedGeneratorKey === key) {
        return cachedGenerator;
    }

    // The generator only uses the world for population (trees/houses) which the
    // server does not run; a stub is enough for terrain generation.
    const world = { seed: seedLong, getBlockAt: () => 0 };
    cachedGenerator = new WorldGeneratorClass(world, seedLong, worldType);
    cachedGeneratorKey = key;
    return cachedGenerator;
}

// Lightweight chunk that only stores block ids, mirroring the (y<<8)|(z<<4)|x
// layout used by the client ChunkSection so Primer works unchanged.
class ServerChunk {
    constructor() {
        this.blocks = new Uint8Array(16 * 256 * 16);
    }

    getBlockAt(x, y, z) {
        return this.blocks[(y << 8) | (z << 4) | x];
    }

    setBlockAt(x, y, z, typeId) {
        this.blocks[(y << 8) | (z << 4) | x] = typeId;
    }
}

// Generate the raw base-terrain column for a chunk (terrain + caves + ores,
// no population). Deterministic: the RNG is seeded explicitly, so output never
// depends on the order chunks are generated.
function generateBaseBlocks(chunkX, chunkZ) {
    const generator = getGenerator();
    if (!generator || !PrimerClass) return null;

    const chunk = new ServerChunk();
    const primer = new PrimerClass(chunk);

    // Same per-chunk seed used by the client's newChunk() so both sides
    // produce byte-identical terrain.
    generator.random.setSeed(chunkX * 0x4f9939f508 + chunkZ * 0x1ef1565bd5);
    generator.generateInChunk(chunkX, chunkZ, primer);

    return chunk.blocks;
}

// Cache of pure base terrain. Tree/house placement must read this (never the
// final blocks) so it is deterministic, and reading from cache avoids hitting
// the shared terrain generator mid-population.
const baseCache = new Map();
const BASE_CACHE_MAX = 256;

function getBaseBlocks(chunkX, chunkZ) {
    const key = getGeneratorKey() + ':' + chunkX + ',' + chunkZ;
    let blocks = baseCache.get(key);
    if (blocks) return blocks;

    blocks = generateBaseBlocks(chunkX, chunkZ);
    if (!blocks) return null;

    baseCache.set(key, blocks);
    if (baseCache.size > BASE_CACHE_MAX) {
        const oldestKey = baseCache.keys().next().value;
        baseCache.delete(oldestKey);
    }
    return blocks;
}

// Read/write facade the client's tree/house generators use during population.
// Reads always see pure base terrain so a chunk's structures are identical no
// matter when or in what order it is generated. Writes are clamped to the
// target chunk so each chunk owns exactly the structure blocks that fall
// inside it; the chunk a structure is centered on reproduces the matching
// part, so trees spanning chunk borders line up exactly.
class PopulateWorldStub {
    constructor() {
        this.blocks = null;  // final blocks of the chunk being built
        this.targetX = 0;    // chunk we write into
        this.targetZ = 0;
    }

    getBlockAt(x, y, z) {
        if (y < 0 || y >= 256) return 0;
        const blocks = getBaseBlocks(x >> 4, z >> 4);
        if (!blocks) return 0;
        return blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }

    setBlockAt(x, y, z, typeId) {
        if (y < 0 || y >= 256) return;
        if ((x >> 4) !== this.targetX || (z >> 4) !== this.targetZ) return;
        this.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] = typeId;
    }

    getHeightAt(x, z) {
        const blocks = getBaseBlocks(x >> 4, z >> 4);
        if (!blocks) return 0;
        const lx = x & 15;
        const lz = z & 15;
        for (let y = 255; y >= 0; y--) {
            if (blocks[(y << 8) | (lz << 4) | lx] !== 0) return y + 1;
        }
        return 0;
    }

    getHighestBlockAt(x, z) {
        return this.getHeightAt(x, z) - 1;
    }
}

// Population needs its own generator instance: it shares the RNG with the
// terrain generator in the client, but here base terrain can be regenerated
// on demand mid-population, which would corrupt the population RNG stream.
let cachedPopulateGenerator = null;
let cachedPopulateGeneratorKey = null;

function getPopulateGenerator() {
    if (!WorldGeneratorClass) return null;

    const worldType = getWorldType();
    const seedLong = seedToLong(config.seed);
    const key = worldType + ':' + seedLong.toString();

    if (cachedPopulateGenerator && cachedPopulateGeneratorKey === key) {
        return cachedPopulateGenerator;
    }

    const world = { seed: seedLong, getBlockAt: () => 0 };
    cachedPopulateGenerator = new WorldGeneratorClass(world, seedLong, worldType);
    cachedPopulateGeneratorKey = key;
    return cachedPopulateGenerator;
}

const populateStub = new PopulateWorldStub();

// Generate the final block-id column for a chunk: base terrain plus the
// population phase (trees, underground houses). To match the client, each
// chunk re-runs the population of its 1-ring neighborhood and keeps the
// structure blocks that fall inside it.
function generateBlocks(chunkX, chunkZ) {
    const blocks = getBaseBlocks(chunkX, chunkZ);
    if (!blocks) return null;

    const populateGenerator = getPopulateGenerator();
    if (!populateGenerator) return blocks;

    populateStub.blocks = blocks;
    populateStub.targetX = chunkX;
    populateStub.targetZ = chunkZ;
    populateGenerator.world = populateStub;

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            populateGenerator.populateChunk(chunkX + dx, chunkZ + dz);
        }
    }

    return blocks;
}

// Cache recently generated columns. Terrain never changes at runtime, so a
// small LRU is enough to avoid regenerating chunks for every block lookup.
// Cache entries are keyed by generator (world type + seed) plus chunk coords
// so changing the config mid-flight can never serve stale terrain.
const blockCache = new Map();
const BLOCK_CACHE_MAX = 64;

function getColumnBlocks(chunkX, chunkZ) {
    if (getWorldType() === 'flat') return null;

    const key = getGeneratorKey() + ':' + chunkX + ',' + chunkZ;
    let blocks = blockCache.get(key);
    if (blocks) return blocks;

    blocks = generateBlocks(chunkX, chunkZ);
    if (!blocks) return null;

    blockCache.set(key, blocks);
    if (blockCache.size > BLOCK_CACHE_MAX) {
        const oldestKey = blockCache.keys().next().value;
        blockCache.delete(oldestKey);
    }
    return blocks;
}

// Flat-world block id for a given height (kept identical to the old server
// flat generator so existing flat worlds stay byte-for-byte unchanged).
function flatBlockId(worldY) {
    if (worldY === 0) return 7;              // Bedrock
    if (worldY >= 1 && worldY <= 7) return 1; // Stone
    if (worldY === 8) return 3;              // Dirt
    if (worldY === 9) return 2;              // Grass
    return 0;                                // Air
}

function blockStateAt(worldX, worldY, worldZ, worldChanges, blocks) {
    const blockState = worldChanges.get(worldX + ',' + worldY + ',' + worldZ);
    if (blockState !== undefined) {
        return blockState;
    }

    let blockId;
    if (blocks) {
        blockId = blocks[((worldY & 255) << 8) | ((worldZ & 15) << 4) | (worldX & 15)];
    } else {
        blockId = flatBlockId(worldY);
    }
    return (blockId << 4) | 0;
}

// Build the full chunk data buffer (same format the server always sent for
// flat worlds) for the configured world type and seed.
function generateChunkColumn(chunkX, chunkZ, worldChanges) {
    const buffer = Buffer.alloc(SECTION_SIZE * SECTION_COUNT + 256);
    const blocks = getColumnBlocks(chunkX, chunkZ);

    for (let sectionIndex = 0; sectionIndex < SECTION_COUNT; sectionIndex++) {
        const sectionOffset = sectionIndex * SECTION_SIZE;
        const baseY = sectionIndex * 16;

        for (let y = 0; y < 16; y++) {
            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    const localIndex = ((y << 8) | (z << 4) | x) * 2;
                    const worldY = baseY + y;
                    const worldX = chunkX * 16 + x;
                    const worldZ = chunkZ * 16 + z;
                    buffer.writeUInt16LE(
                        blockStateAt(worldX, worldY, worldZ, worldChanges, blocks),
                        sectionOffset + localIndex
                    );
                }
            }
        }

        const lightOffset = sectionOffset + BLOCK_STATE_SIZE;
        buffer.fill(0xFF, lightOffset, lightOffset + NIBBLE_SIZE);
        buffer.fill(0xFF, lightOffset + NIBBLE_SIZE, lightOffset + NIBBLE_SIZE * 2);
    }

    buffer.fill(1, SECTION_SIZE * SECTION_COUNT);

    return buffer;
}

// Base block id for unmodified positions, backed by generated terrain so the
// server's block logic (bluestone simulation, neighbor ticks) sees the same
// world the clients do.
function getBaseBlockAt(x, y, z) {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const blocks = getColumnBlocks(cx, cz);
    if (!blocks) {
        return flatBlockId(y);
    }
    return blocks[((y & 255) << 8) | ((z & 15) << 4) | (x & 15)];
}

// Block ids that are structures rather than terrain: logs and leaves must not
// count as "surface" or spawn would land on top of a tree canopy.
const NON_SURFACE_IDS = new Set([17, 18]); // LOG, LEAVE

// Highest non-air, non-tree block in a generated column at world (x, z).
function getSurfaceTop(x, z, blocks) {
    const lx = x & 15;
    const lz = z & 15;
    for (let y = 255; y >= 0; y--) {
        const id = blocks[(y << 8) | (lz << 4) | lx];
        if (id !== 0 && !NON_SURFACE_IDS.has(id)) return y;
    }
    return 0;
}

// Find a safe spawn position. A naive "top of the (0,0) column" can land the
// player inside a cave when a cave mouth carves the surface at spawn: the
// column's highest block becomes the cave floor. Instead, scan a grid around
// (0,0) and pick the column with the highest surface (a hilltop or flat
// surface). A cave floor is by definition lower than its rim, so the local
// maximum is never a cave floor (and is never an ocean floor when land is
// nearby, since the sea surface sits below any land). Closest column wins
// ties so spawn stays as near (0,0) as possible.
function getSpawnPosition() {
    if (getWorldType() === 'flat') {
        return { x: 0, y: 10, z: 0 };
    }

    const RADIUS = 16;
    let bestX = 0;
    let bestZ = 0;
    let bestTop = 0;
    let bestDist = Infinity;

    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            const blocks = getColumnBlocks(Math.floor(dx / 16), Math.floor(dz / 16));
            if (!blocks) continue;

            const top = getSurfaceTop(dx, dz, blocks);
            const dist = Math.abs(dx) + Math.abs(dz);
            if (top > bestTop || (top === bestTop && dist < bestDist)) {
                bestTop = top;
                bestX = dx;
                bestZ = dz;
                bestDist = dist;
            }
        }
    }

    if (bestTop <= 1) {
        return { x: 0, y: 10, z: 0 };
    }
    return { x: bestX, y: bestTop + 1, z: bestZ };
}

module.exports = {
    normalizeWorldType,
    getWorldType,
    generateChunkColumn,
    getBaseBlockAt,
    getSpawnPosition
};
