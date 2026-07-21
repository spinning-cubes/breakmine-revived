import Block from "../Block.js";

export default class BlockWool extends Block {

    constructor(id, textureSlotId, textureName, name) {
        super(id, textureSlotId);
        this.description = name;
        this.textureName = textureName;
        this.hardness = 0.8;
        this.sound = Block.sounds.cloth;
    }

    getTextureForFace(face) {
        return this.textureName;
    }
}
