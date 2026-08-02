import BoundingBox from "../../../../util/BoundingBox.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";
import Block from "../Block.js";
import BlockEntityBluestoneDust from "../entity/BlockEntityBluestoneDust.js";

const MAX_POWER = 15;
const TICK_DELAY = 1;

export default class BlockBluestoneDust extends Block {
    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bluestone Dust";
        this.hardness = 0.5;
        this.inventoryTab = EnumCreativeInventoryTab.MACHINES;
    }

    hasBlockEntity() { return true; }

    createBlockEntity(world, x, y, z) {
        return new BlockEntityBluestoneDust(world, x, y, z);
    }

    shouldRenderFace(world, x, y, z, face) {
        return face === EnumBlockFace.TOP;
    }

    getTextureForFace(face, data, x, y, z, world) {
        if (!world || typeof x !== 'number') {
            return 'bluestoneDust0000';
        }

        const isConnectable = (tx, tz, targetFace) => this.canConnect(world, tx, y, tz, targetFace);
        const up    = isConnectable(x, z - 1, EnumBlockFace.SOUTH) ? "1" : "0";
        const down  = isConnectable(x, z + 1, EnumBlockFace.NORTH) ? "1" : "0";
        const left  = isConnectable(x - 1, z, EnumBlockFace.EAST) ? "1" : "0";
        const right = isConnectable(x + 1, z, EnumBlockFace.WEST) ? "1" : "0";

        return `bluestoneDust${up}${down}${left}${right}`;
    }

    canConnect(world, x, y, z, targetFace) {
        const blockId = world.getBlockAt(x, y, z);
        if (blockId === this.id) return true;
        const block = Block.getById(blockId);
        if (!block) return false;

        if (typeof block.bluestoneConnectingFaces === 'function') {
            const faces = block.bluestoneConnectingFaces(world, x, y, z);
            if (Array.isArray(faces)) {
                return faces.includes(targetFace);
            }
        }

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
        // Corrected neighborFace values:
        // +X (East block) -> Facing Dust via WEST face
        // -X (West block) -> Facing Dust via EAST face
        // +Z (South block) -> Facing Dust via NORTH face
        // -Z (North block) -> Facing Dust via SOUTH face
        // -Y (Bottom block) -> Facing Dust via TOP face
        // +Y (Top block) -> Facing Dust via BOTTOM face
        const neighbors = [
            [x + 1, y, z, EnumBlockFace.WEST],
            [x - 1, y, z, EnumBlockFace.EAST],
            [x, y, z + 1, EnumBlockFace.NORTH],
            [x, y, z - 1, EnumBlockFace.SOUTH],
            [x, y - 1, z, EnumBlockFace.TOP],
            [x, y + 1, z, EnumBlockFace.BOTTOM],
        ];

        let best = 0;

        for (const [nx, ny, nz, neighborFace] of neighbors) {
            const blockId = world.getBlockAt(nx, ny, nz);
            if (blockId === undefined || blockId === null || blockId === -1) continue;

            const block = Block.getById(blockId);
            if (!block) continue;

            if (blockId === this.id) {
                const p = this.getPower(world, nx, ny, nz) - 1;
                if (p > best) best = p;
            } else if (typeof block.getPower === 'function') {
                const p = block.getPower(world, nx, ny, nz, neighborFace);
                if (p > best) best = p;
            } else if (block.isPowerSource) {
                return MAX_POWER;
            }
        }

        return Math.max(0, best);
    }

    _neighborOffsets() {
        return [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 0, 1],
            [0, 0, -1],
            [0, -1, 0],
            [0, 1, 0],
        ];
    }

    _scheduleNeighbors(world, x, y, z) {
        for (const [dx, dy, dz] of this._neighborOffsets()) {
            world.scheduleBlockTick(x + dx, y + dy, z + dz, TICK_DELAY);
        }
    }

    onBlockAdded(world, x, y, z) {
        world.onBlockChanged(x + 1, y, z);
        world.onBlockChanged(x - 1, y, z);
        world.onBlockChanged(x, y, z + 1);
        world.onBlockChanged(x, y, z - 1);

        // Recalculate immediately so a freshly placed wire joins the network
        // (and lights up / settles) in the same tick instead of after a delay.
        this.onBlockTick(world, x, y, z);
    }

    onBlockRemoved(world, x, y, z) {
        world.setBlockDataAt(x, y, z, 0);

        // Recalculate connected wires immediately so the network settles to
        // its new state in one tick rather than fading out block by block.
        for (const [dx, dy, dz] of this._neighborOffsets()) {
            if (world.getBlockAt(x + dx, y + dy, z + dz) === this.id) {
                this.onBlockTick(world, x + dx, y + dy, z + dz);
            }
        }

        this._scheduleNeighbors(world, x, y, z);
    }

    onBlockTick(world, x, y, z) {
        if (world.getBlockAt(x, y, z) !== this.id) return;
        this._propagate(world, x, y, z);
    }

    /**
     * Synchronously settle the connected wire network to its fixpoint so
     * power changes take effect immediately (one tick) instead of trickling
     * through one block per tick. Only dusts whose computed power changes are
     * re-queued, so the cascade terminates once the network is stable.
     */
    _propagate(world, x, y, z) {
        const queue = [[x, y, z]];
        let steps = 0;

        while (queue.length > 0 && steps < 4096) {
            steps++;
            const [cx, cy, cz] = queue.pop();

            const newPower     = this.calculatePower(world, cx, cy, cz);
            const currentPower = this.getPower(world, cx, cy, cz);
            if (newPower === currentPower) continue;

            world.setBlockDataAt(cx, cy, cz, newPower);
            world.onBlockChanged(cx, cy, cz);

            // Wake up adjacent consumers (lamps, repeaters, observers, ...)
            // so they react to the change on the next scheduled tick.
            this._scheduleNeighbors(world, cx, cy, cz);

            for (const [dx, dy, dz] of this._neighborOffsets()) {
                if (world.getBlockAt(cx + dx, cy + dy, cz + dz) === this.id) {
                    queue.push([cx + dx, cy + dy, cz + dz]);
                }
            }
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