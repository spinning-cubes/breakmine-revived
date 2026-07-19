import Block from "../Block.js";

export default class BlockStone extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Stone";
        this.hardness = 1.5;
    }
    
    getDrop(world, x, y, z) {
        return [0, 1];
    }

    getTextureForFace(face) {
        return 'stone';
    }
}