import Block from "../Block.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class BlockFurnace extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Furnace";
        this.hardness = 3.5;
    }

    getTextureForFace(face) {
        switch (face) {
            case EnumBlockFace.NORTH:
                return 'furnace_front_off';
            case EnumBlockFace.TOP:
                return 'furnace_top';
            case EnumBlockFace.BOTTOM:
                return 'furnace_bottom';
            default:
                return 'furnace_side';
        }
    }

    onMouseButton(world, x, y, z, button) {
        if (button === 2) {
            // TODO: Open furnace GUI
            return true;
        }
        return false;
    }
}