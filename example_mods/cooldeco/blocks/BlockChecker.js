import Block from "../Block.js";

export default class BlockChecker extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Checker Block";
        this.hardness = 3.5;
    }

    getTextureForFace(face) {
        //<modId>:<textureName>
        return 'cooldeco:checker';
    }
}