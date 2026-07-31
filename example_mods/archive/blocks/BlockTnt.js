import Explosive from "Explosive.js";

export default class BlockTnt extends Explosive {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "TNT Block";
        this.hardness = 0.1;
        this.sound = Block.sounds.grass;
    }

    getTextureForFace(face) {
        switch (face) {
            case EnumBlockFace.TOP:
            case EnumBlockFace.BOTTOM:
                return 'bombsandshiz:tntBottom';
            default:
                return 'bombsandshiz:tntSide';
        }
    }
}