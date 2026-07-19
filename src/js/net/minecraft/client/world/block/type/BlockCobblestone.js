import Block from "../Block.js";

export default class BlockCobblestone extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Cobblestone";
        this.hardness = 2.0;
    }

    getTextureForFace(face) {
        return 'cobblestone';
    }
}