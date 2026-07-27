import ItemEdible from "../ItemEdible.js";

export default class ItemBread extends ItemEdible {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bread";
        this.healAmount = 4;
    }

    getTextureForFace(face) {
        return 'bread';
    }
}
