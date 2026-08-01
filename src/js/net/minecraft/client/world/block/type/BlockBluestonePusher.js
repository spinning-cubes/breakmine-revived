import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import Block from "../Block.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";

export default class BlockBluestonePusher extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bluestone Pusher";
        this.hardness = 0.3;
        this.isBluestoneConsumer = true;
        this.inventoryTab = EnumCreativeInventoryTab.MACHINES;
    }

    isSolid() { return true; }

    isPowered(world, x, y, z) {
        const neighbors = [
            [x + 1, y, z],
            [x - 1, y, z],
            [x, y, z + 1],
            [x, y, z - 1],
            [x, y - 1, z]
        ];

        for (const [nx, ny, nz] of neighbors) {
            const blockId = world.getBlockAt(nx, ny, nz);
            if (blockId === undefined || blockId === null || blockId === -1) continue;

            const block = Block.getById(blockId);
            if (!block) continue;

            if (block.isPowerSource) return true;

            if (typeof block.getPower === 'function') {
                if (block.getPower(world, nx, ny, nz) > 0) return true;
            }
        }

        return false;
    }

    getState(world, x, y, z) {
        const data = world.getBlockDataAt(x, y, z);
        return (data & 1) === 1 ? 1 : 0;
    }

    pushBlockOnTop(world, x, y, z) {
        const targetY = y + 1;
        const targetId = world.getBlockAt(x, targetY, z);

        if (targetId === undefined || targetId === null || targetId === 0 || targetId === -1) {
            return;
        }

        const dy = 1;
        const MAX_PUSH_LIMIT = 30;

        const blocksToPush = [];
        let currY = targetY;

        for (let i = 0; i < MAX_PUSH_LIMIT; i++) {
            const bId = world.getBlockAt(x, currY, z);

            if (bId === undefined || bId === null || bId === 0 || bId === -1) {
                break;
            }

            const block = Block.getById(bId);
            if (block && block.unpushable) {
                return;
            }

            const bData = world.getBlockDataAt(x, currY, z) || 0;
            blocksToPush.push({ x: x, y: currY, z: z, id: bId, data: bData });

            if (i === MAX_PUSH_LIMIT - 1) {
                const nextId = world.getBlockAt(x, currY + dy, z);
                if (nextId !== 0 && nextId !== undefined && nextId !== null && nextId !== -1) {
                    return;
                }
            }

            currY += dy;
        }

        for (let i = blocksToPush.length - 1; i >= 0; i--) {
            const b = blocksToPush[i];
            const nextY = b.y + dy;

            world.setBlockAt(b.x, nextY, b.z, b.id);
            world.setBlockDataAt(b.x, nextY, b.z, b.data);
            world.onBlockChanged(b.x, nextY, b.z);
        }

        world.setBlockAt(x, targetY, z, 0);
        world.setBlockDataAt(x, targetY, z, 0);
        world.onBlockChanged(x, targetY, z);
    }

    updateState(world, x, y, z) {
        if (world.getBlockAt(x, y, z) !== this.id) return;

        const isNowPowered = this.isPowered(world, x, y, z);
        const currentState = this.getState(world, x, y, z);

        if (isNowPowered && currentState === 0) {
            world.setBlockDataAt(x, y, z, 1);
            world.onBlockChanged(x, y, z);
            this.pushBlockOnTop(world, x, y, z);
        } else if (!isNowPowered && currentState === 1) {
            world.setBlockDataAt(x, y, z, 0);
            world.onBlockChanged(x, y, z);
        }
    }

    getTextureForFace(face, data, x, y, z, world) {
        if (face === EnumBlockFace.TOP) {
            return 'oak_planks';
        } else if (face === EnumBlockFace.BOTTOM) {
            return 'cobblestone_frame';
        }
        if (!world || typeof x !== 'number') {
            return 'bluestonePusherOff';
        }
        return this.getState(world, x, y, z) === 1
            ? 'bluestonePusherOn'
            : 'bluestonePusherOff';
    }

    onBlockAdded(world, x, y, z) {
        world.scheduleBlockTick(x, y, z, 1);
    }

    onBlockTick(world, x, y, z) {
        this.updateState(world, x, y, z);
    }
}