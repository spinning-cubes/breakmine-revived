import Item from "../Item.js";

export default class ItemStick extends Item {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Stick";
    }

    getTextureForFace(face) {
        return 'stick';
    }
}
