import Block from "../Block.js";
import GuiSign from "../../../gui/screens/GuiSign.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import BoundingBox from "../../../../util/BoundingBox.js";

export default class BlockSign extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Sign";
        this.renderType = 1; // Custom render type for sign
    }

    getTextureForFace(face) {
        return 'oak_planks';
    }

    getBoundingBox() {
        return new BoundingBox(0.25, 0, 0.25, 0.75, 1, 0.75);
    }

    onMouseButton(world, x, y, z, button) {
        if (button === 2) {
            world.minecraft.displayScreen(new GuiSign(world.minecraft.player, { x, y, z }));
            return true;
        }
        return false;
    }
}
