import Block from "../Block.js";

export default class BlockBluestoneBlock extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bluestone Block";
        this.hardness = 3.0;
        this.isPowerSource = true;
    }

    getTextureForFace(face, data, x, y, z, world) {
        return 'bs-logic:bluestoneBlock';
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
            world.scheduleBlockTick(nx, ny, nz, 1);
        }
    }

    onBlockAdded(world, x, y, z) {
        this._scheduleNeighbors(world, x, y, z);
    }

    onBlockRemoved(world, x, y, z) {
        this._scheduleNeighbors(world, x, y, z);
    }
}