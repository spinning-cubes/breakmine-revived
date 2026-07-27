import Block from "../Block.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class BlockFurnace extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Furnace";
        this.hardness = 3.5;
    }
    
    getPreferredToolType() {
        return 'pickaxe';
    }

    getTextureForFace(face, data) {
        let facing = data & 7;
        if (facing === 0) facing = 2;
        switch (face) {
            case EnumBlockFace.NORTH:
                return facing === 2 ? 'furnace_front_off' : 'furnace_side';
            case EnumBlockFace.SOUTH:
                return facing === 3 ? 'furnace_front_off' : 'furnace_side';
            case EnumBlockFace.WEST:
                return facing === 4 ? 'furnace_front_off' : 'furnace_side';
            case EnumBlockFace.EAST:
                return facing === 5 ? 'furnace_front_off' : 'furnace_side';
            case EnumBlockFace.TOP:
                return 'furnace_top';
            case EnumBlockFace.BOTTOM:
                return 'furnace_top';
            default:
                return 'furnace_side';
        }
    }

    onBlockPlaced(world, x, y, z, face) {
        if (world && world.minecraft && world.minecraft.player) {
            let player = world.minecraft.player;
            let dirIndex = Math.floor((player.rotationYaw * 4 / 360) + 0.5) & 3;
            let data = [2, 5, 3, 4][dirIndex];
            world.setBlockDataAt(x, y, z, data);
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