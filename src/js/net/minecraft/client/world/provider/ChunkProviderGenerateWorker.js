import ChunkProvider from "./ChunkProvider.js";
import Chunk from "../Chunk.js";
import ChunkSection from "../ChunkSection.js";
import Random from "../../../util/Random.js";
import Long from "../../../../../../../libraries/long.js";

export default class ChunkProviderGenerateWorker extends ChunkProvider {

    constructor(world, seed, worldType = "normal") {
        super(world);

        this.seed = seed;
        this.seedData = { low: seed.low, high: seed.high };
        this.worldType = worldType;
        this.pendingChunks = new Map();

        const workerUrl = new URL("../worker/worldgen.worker.js", import.meta.url);
        this.worker = new Worker(workerUrl, { type: "module" });

        this.worker.onmessage = (e) => this._onWorkerMessage(e.data);
    }

    _onWorkerMessage(data) {
        if (data.type === "chunkGenerated") {
            const results = data.results;
            for (const result of results) {
                const key = result.x + (result.z << 16);
                const pending = this.pendingChunks.get(key);
                if (pending) {
                    this.pendingChunks.delete(key);
                    pending.resolve(result);
                }
            }
        }

        if (data.type === "batchGenerated") {
            const results = data.results;
            for (const result of results) {
                const key = result.x + (result.z << 16);
                const pending = this.pendingChunks.get(key);
                if (pending) {
                    this.pendingChunks.delete(key);
                    pending.resolve(result);
                }
            }
        }
    }

    _requestChunkFromWorker(chunkX, chunkZ) {
        const key = chunkX + (chunkZ << 16);

        if (this.pendingChunks.has(key)) {
            return this.pendingChunks.get(key).promise;
        }

        const promise = new Promise((resolve) => {
            this.pendingChunks.set(key, { resolve });
        });

        this.worker.postMessage({
            type: "generate",
            chunkX,
            chunkZ,
            seed: this.seedData,
            worldType: this.worldType,
        });

        return promise;
    }

    _deserializeChunk(result) {
        const chunk = new Chunk(this.world, result.x, result.z);

        for (let y = 0; y < ChunkSection.SIZE * 16 / ChunkSection.SIZE; y++) {
            if ((result.sectionMask & (1 << y)) === 0) continue;

            const sectionData = result.sections[y];
            if (!sectionData) continue;

            const section = chunk.getSection(y);
            section.empty = false;

            for (let i = 0; i < 4096; i++) {
                const typeId = sectionData.blocks[i];
                if (typeId !== 0) {
                    section.blocks[i] = typeId;
                    section.blocksData[i] = sectionData.blocksData[i];
                }
            }

            for (let i = 0; i < 4096; i++) {
                const byteIndex = i >> 1;
                const isHigh = (i & 1) === 0;
                const bl = isHigh
                    ? (sectionData.blockLight[byteIndex] >> 4) & 0xF
                    : sectionData.blockLight[byteIndex] & 0xF;
                const sl = isHigh
                    ? (sectionData.skyLight[byteIndex] >> 4) & 0xF
                    : sectionData.skyLight[byteIndex] & 0xF;
                if (bl !== 0) section.blockLight[i] = bl;
                if (sl !== 0) section.skyLight[i] = sl;
            }
        }

        for (let i = 0; i < 256; i++) {
            chunk.heightMap[i] = result.heightMap[i];
        }

        chunk.setModifiedAllSections();
        return chunk;
    }

    async getChunkAtAsync(chunkX, chunkZ) {
        const index = chunkX + (chunkZ << 16);
        const existing = this.chunks.get(index);
        if (existing) return existing;

        const result = await this._requestChunkFromWorker(chunkX, chunkZ);

        const chunk = this._deserializeChunk(result);
        chunk.loaded = true;
        this.chunks.set(index, chunk);
        this.world.group.add(chunk.group);

        return chunk;
    }

    getChunkAt(chunkX, chunkZ) {
        const index = chunkX + (chunkZ << 16);
        const existing = this.chunks.get(index);
        if (existing) return existing;

        const pending = this.pendingChunks.get(index);
        if (pending) return null;

        this._requestChunkFromWorker(chunkX, chunkZ);
        return null;
    }

    async loadChunksAsync(chunkCoords) {
        const results = await Promise.all(
            chunkCoords.map(([x, z]) => this.getChunkAtAsync(x, z))
        );

        for (const chunk of results) {
            this.populateChunk(chunk);
        }

        return results;
    }

    async loadChunksBatchAsync(chunkCoords) {
        const unloadedCoords = [];
        for (const [x, z] of chunkCoords) {
            const index = x + (z << 16);
            if (!this.chunks.has(index) && !this.pendingChunks.has(index)) {
                unloadedCoords.push([x, z]);
            }
        }

        if (unloadedCoords.length === 0) {
            for (const [x, z] of chunkCoords) {
                const chunk = this.chunks.get(x + (z << 16));
                if (chunk) this.populateChunk(chunk);
            }
            return chunkCoords.map(([x, z]) => this.chunks.get(x + (z << 16))).filter(Boolean);
        }

        const batchPromise = new Promise((resolve) => {
            for (const [x, z] of unloadedCoords) {
                const key = x + (z << 16);
                this.pendingChunks.set(key, { resolve: (result) => {
                    const chunk = this._deserializeChunk(result);
                    chunk.loaded = true;
                    this.chunks.set(key, chunk);
                    this.world.group.add(chunk.group);
                }});
            }

            const prevHandler = this.worker.onmessage;
            this.worker.onmessage = (e) => {
                prevHandler(e);
                if (e.data.type === "batchGenerated") {
                    this.worker.onmessage = prevHandler;
                    resolve();
                }
            };

            this.worker.postMessage({
                type: "generateBatch",
                coords: unloadedCoords,
                seed: this.seedData,
                worldType: this.worldType,
            });
        });

        await batchPromise;

        const loaded = [];
        for (const [x, z] of chunkCoords) {
            const chunk = this.chunks.get(x + (z << 16));
            if (chunk) {
                this.populateChunk(chunk);
                loaded.push(chunk);
            }
        }

        return loaded;
    }

    populateChunk(chunk) {
        const x = chunk.x;
        const z = chunk.z;

        if (!chunk.isTerrainPopulated
            && this.chunkExists(x + 1, z + 1)
            && this.chunkExists(x, z + 1)
            && this.chunkExists(x + 1, z)) {
            this._populateChunkAt(x, z);
        }
        if (this.chunkExists(x - 1, z)
            && !this.getChunkAt(x - 1, z)?.isTerrainPopulated
            && this.chunkExists(x - 1, z + 1)
            && this.chunkExists(x, z + 1)
            && this.chunkExists(x - 1, z)) {
            this._populateChunkAt(x - 1, z);
        }
        if (this.chunkExists(x, z - 1)
            && !this.getChunkAt(x, z - 1)?.isTerrainPopulated
            && this.chunkExists(x + 1, z - 1)
            && this.chunkExists(x, z - 1)
            && this.chunkExists(x + 1, z)) {
            this._populateChunkAt(x, z - 1);
        }
        if (this.chunkExists(x - 1, z - 1)
            && !this.getChunkAt(x - 1, z - 1)?.isTerrainPopulated
            && this.chunkExists(x - 1, z - 1)
            && this.chunkExists(x, z - 1)
            && this.chunkExists(x - 1, z)) {
            this._populateChunkAt(x - 1, z - 1);
        }
    }

    _populateChunkAt(x, z) {
        const chunk = this.getChunkAt(x, z);
        if (chunk && !chunk.isTerrainPopulated) {
            chunk.isTerrainPopulated = true;
        }
    }

    async findSpawnAsync() {
        const spawn = this.world.spawn;
        if (spawn.y <= 0) spawn.y = 64;

        const random = new Random(this.seed);
        let attempts = 0;
        while (attempts < 1000) {
            const chunkX = spawn.x >> 4;
            const chunkZ = spawn.z >> 4;

            await this.getChunkAtAsync(chunkX, chunkZ);

            const block = this.world.getBlockAt(spawn.x, spawn.y + 1, spawn.z);
            if (block !== 0) break;

            spawn.x += random.nextInt(8) - random.nextInt(8);
            spawn.z += random.nextInt(8) - random.nextInt(8);
            attempts++;
        }
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingChunks.clear();
    }

    getGenerator() {
        return { seed: this.seed, getSeed: () => this.seed, getSeaLevel: () => 64 };
    }
}
