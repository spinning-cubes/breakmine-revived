import Block from "../Block.js";

export default class BlockWood extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Oak Planks";
        this.hardness = 2.0;
    }

    getTextureForFace(face) {
        return 'planks_oak';
    }
}
