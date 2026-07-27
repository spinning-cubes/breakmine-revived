import Block from "./Block.js";
import BlockRenderType from "../../../util/BlockRenderType.js";
import EnumBlockFace from "../../../util/EnumBlockFace.js";
import BoundingBox from "../../../util/BoundingBox.js";

export default class Item extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.boundingBox = new BoundingBox(0.0, 0.0, 0.0, 0.0, 1.0, 1.0);
    }
    
    getTextureForFace(face) {
        return 'missing';
    }

    isItem() {
        return true;
    }

    getRenderType() {
        return BlockRenderType.ITEM;
    }
}
