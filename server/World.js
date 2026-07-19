// Server-side World emulation for block ticking using game code BlockRegistry
const { getBlockAt } = require('../world');
const { Block } = require('../src/js/net/minecraft/client/world/block/Block.js');

class ServerWorld {
    constructor() {
        this.scheduledBlockTicks = new Map();
        this.blockTickQueue = [];
    }

    // Get block at position
    getBlockAt(x, y, z) {
        return getBlockAt(x, y, z);
    }

    // Schedule a block tick
    scheduleBlockTick(x, y, z, delay) {
        const key = `${x},${y},${z}`;
        const tickTime = Date.now() + (delay * 1000); // delay is in seconds
        this.scheduledBlockTicks.set(key, { x, y, z, tickTime });
    }

    // Process block ticks
    onTick() {
        const now = Date.now();

        // Check scheduled ticks
        for (const [key, tick] of this.scheduledBlockTicks.entries()) {
            if (now >= tick.tickTime) {
                this.blockTickQueue.push({ x: tick.x, y: tick.y, z: tick.z });
                this.scheduledBlockTicks.delete(key);
            }
        }

        // Process queued ticks
        while (this.blockTickQueue.length > 0) {
            const { x, y, z } = this.blockTickQueue.shift();
            const blockId = this.getBlockAt(x, y, z);
            const block = Block.getById(blockId);

            if (block && block.onBlockTick) {
                try {
                    block.onBlockTick(this, x, y, z);
                } catch (e) {
                    console.error(`Error ticking block at ${x},${y},${z}:`, e);
                }
            }
        }
    }
}

module.exports = ServerWorld;
