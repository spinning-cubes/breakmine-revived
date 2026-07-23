import Block from "../Block.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class BlockLava extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Lava";
        this.hardness = -1.0;
    }

    isReplaceable(world, x, y, z) {
        return true;
    }

    getTextureForFace(face) {
        return 'lava';
    }

    getLightValue() {
        return 15;
    }

    getOpacity() {
        return 0.01;
    }

    getTransparency() {
        return 0.2;
    }

    isSolid() {
        return false;
    }

    isTranslucent() {
        return true;
    }

    isLiquid() {
        return true;
    }

    isLava() {
        return true;
    }

    canInteract() {
        return false;
    }

    shouldRenderFace(world, x, y, z, face) {
        let typeId = world.getBlockAtFace(x, y, z, face);
        return typeId === 0 || typeId !== this.id || typeId !== this.id && face === EnumBlockFace.TOP;
    }

    getBoundingBox(world, x, y, z) {
        let box = this.boundingBox.clone();
        if (world !== null && world.getBlockAt(x, y + 1, z) !== this.id) {
            box.maxY = 1.0 - 0.12;
        }
        return box;
    }
}