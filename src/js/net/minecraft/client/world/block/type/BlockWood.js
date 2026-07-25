import Block from "../Block.js";

export default class BlockWood extends Block {

    constructor(id, textureSlotId, woodType = "oak", displayName = "Oak Planks") {
        super(id, textureSlotId);
        this.description = displayName;
        this.woodType = woodType;
        this.hardness = 2.0;
    }

    getTextureForFace(face) {
        return this.woodType + '_planks';
    }
}
