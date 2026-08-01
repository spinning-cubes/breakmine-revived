import BoundingBox from "../../../../util/BoundingBox.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";
import Block from "../Block.js";

const MAX_POWER = 15;
const TICK_DELAY = 1;

export default class BlockBluestoneDust extends Block {
    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bluestone Dust";
        this.hardness = 0.5;
        this.inventoryTab = EnumCreativeInventoryTab.MACHINES;
    }

    shouldRenderFace(world, x, y, z, face) {
        return face === EnumBlockFace.TOP;
    }

    getTextureForFace(face, data, x, y, z, world) {
        if (!world || typeof x !== 'number') {
            return 'bluestoneDust0000';
        }

        const isConnectable = (tx, tz) => this.canConnect(world, tx, y, tz);
        const up    = isConnectable(x, z - 1) ? "1" : "0";
        const down  = isConnectable(x, z + 1) ? "1" : "0";
        const left  = isConnectable(x - 1, z) ? "1" : "0";
        const right = isConnectable(x + 1, z) ? "1" : "0";

        return `bluestoneDust${up}${down}${left}${right}`;
    }

    canConnect(world, x, y, z) {
        const blockId = world.getBlockAt(x, y, z);
        if (blockId === this.id) return true;
        const block = Block.getById(blockId);
        if (!block) return false;
        return !!(block.isPowerSource || block.isBluestoneConsumer);
    }

    isSolid() { return false; }
    getCollisionBoundingBox() { return null; }
    getBoundingBox() { return new BoundingBox(0, 0, 0, 1, 0.0625, 1); }
    isTranslucent() { return true; }

    getPower(world, x, y, z) {
        const data = world.getBlockDataAt(x, y, z);
        return (typeof data === 'number' && data >= 0 && data <= MAX_POWER) ? data : 0;
    }

    calculatePower(world, x, y, z) {
        const neighbors = [
            [x + 1, y, z],
            [x - 1, y, z],
            [x, y, z + 1],
            [x, y, z - 1],
            [x, y - 1, z],
            [x, y + 1, z],
        ];

        let best = 0;

        for (const [nx, ny, nz] of neighbors) {
            const blockId = world.getBlockAt(nx, ny, nz);
            if (blockId === undefined || blockId === null || blockId === -1) continue;

            const block = Block.getById(blockId);

                if (block && block.isPowerSource) {
                return MAX_POWER;
            }

            if (blockId === this.id) {
                const p = this.getPower(world, nx, ny, nz) - 1;
                if (p > best) best = p;
            }
        }

        return Math.max(0, best);
    }

    _scheduleNeighbors(world, x, y, z) {
        const neighbors = [
            [x + 1, y, z],
            [x - 1, y, z],
            [x, y, z + 1],
            [x, y, z - 1],
            [x, y - 1, z],
            [x, y + 1, z],
        ];
        for (const [nx, ny, nz] of neighbors) {
            world.scheduleBlockTick(nx, ny, nz, TICK_DELAY);
        }
    }

    onBlockAdded(world, x, y, z) {
        world.onBlockChanged(x + 1, y, z);
        world.onBlockChanged(x - 1, y, z);
        world.onBlockChanged(x, y, z + 1);
        world.onBlockChanged(x, y, z - 1);

        world.scheduleBlockTick(x, y, z, TICK_DELAY);
    }

    onBlockRemoved(world, x, y, z) {
        world.setBlockDataAt(x, y, z, 0);
        this._scheduleNeighbors(world, x, y, z);
    }

    onBlockTick(world, x, y, z) {
        if (world.getBlockAt(x, y, z) !== this.id) return;

        const newPower     = this.calculatePower(world, x, y, z);
        const currentPower = this.getPower(world, x, y, z);

        if (newPower !== currentPower) {
            world.setBlockDataAt(x, y, z, newPower);
            world.onBlockChanged(x, y, z);
            this._scheduleNeighbors(world, x, y, z);
        }
    }

    getColor(world, x, y, z, face) {
        const power = (world && typeof x === 'number')
            ? this.getPower(world, x, y, z)
            : 0;
        const t = power / MAX_POWER;

        const min = { r: 0x18, g: 0x1A, b: 0x38 };
        const max = { r: 0x30, g: 0x70, b: 0xFF };

        const r = Math.round(min.r + (max.r - min.r) * t);
        const g = Math.round(min.g + (max.g - min.g) * t);
        const b = Math.round(min.b + (max.b - min.b) * t);

        return (r << 16) | (g << 8) | b;
    }

    canCastAmbientOcclusion() { return false; }
}