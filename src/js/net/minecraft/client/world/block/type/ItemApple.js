import ItemEdible from "../ItemEdible.js";

export default class ItemApple extends ItemEdible {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Apple";
        this.healAmount = 2;
    }

    getTextureForFace(face) {
        return 'apple';
    }
}
