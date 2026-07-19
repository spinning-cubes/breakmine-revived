import Block from "../Block.js";
import GuiContainerChest from "../../../gui/screens/container/GuiContainerChest.js"
import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import BoundingBox from "../../../../util/BoundingBox.js";

export default class BlockChest extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Chest";
        this.hardness = 2.5;
        this.boundingBox = new BoundingBox(0.0625, 0.0, 0.0625, 0.9375, 0.875, 0.9375);
        this.noFaceCull = true;
    }

    getTextureForFace(face) {
        switch (face) {
            case EnumBlockFace.NORTH:
                return 'chest_front';
            case EnumBlockFace.TOP:
            case EnumBlockFace.BOTTOM:
                return 'chest_bottom';
            default:
                return 'chest_side';
        }
    }

    shouldRenderFace(world, x, y, z, face) {
        return true;
    }

    getAmbientOcclusion() {
        return false;
    }

    onMouseButton(world, x, y, z, button) {
        if (button === 2) {
            world.minecraft.displayScreen(new GuiContainerChest(world.minecraft.player, { x, y, z }));
            return true;
        }
        return false;
    }
}