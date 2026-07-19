import Block from "../Block.js";

export default class BlockStoneLike extends Block {

    constructor(id, textureSlotId, textureName, name, hardness = 3.0) {
        super(id, textureSlotId);
        this.description = name;
        this.textureName = textureName;
        this.hardness = hardness;

        // Sound
        this.sound = Block.sounds.stone;
    }
    
    getDrop(world, x, y, z) {
        return [0, 1];
    }

    getTextureForFace(face) {
        return this.textureName;
    }
}