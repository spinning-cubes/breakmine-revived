import Item from "../Item.js";

export default class ItemGeneric extends Item {

    constructor(id, textureSlotId, description) {
        super(id, 0);
        this.tex = textureSlotId;
        this.description = description;
    }

    getTextureForFace(face) {
        return this.tex;
    }
}
