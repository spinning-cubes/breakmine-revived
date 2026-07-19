import Block from "../Block.js";

export default class BlockBush extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Flower Bush";
        this.hardness = 0.0;

        // Sound
        this.sound = Block.sounds.grass;
    }

    getTextureForFace(face, data, x, y, z, world) {
        const value = (x + y + z) % 3;
        return value == 0 ? 'bush' : value == 1 ? 'bush2' : 'bush3';
    }
}
