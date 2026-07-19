import Block from "../Block.js";

export default class BlockBrick extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Brick";
    }

    getTextureForFace(face) {
        return 'brick';
    }
}
