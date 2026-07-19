import Block from "../Block.js";

export default class BlockBedrock extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bedrock";
        this.hardness = -1.0;
    }

    getTextureForFace(face) {
        return 'bedrock';
    }
}