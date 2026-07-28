import ItemGeneric from "./ItemGeneric.js";
import { BlockRegistry } from "../BlockRegistry.js";
import Block from "../Block.js";

export default class ItemBucketEmpty extends ItemGeneric {

    constructor(id, textureSlotId, description) {
        super(id, textureSlotId, description);
    }

    onUse(world, x, y, z, itemstack) {
        if (!world || x === undefined || y === undefined || z === undefined || !itemstack) {
            return;
        }

        const targetTypeId = world.getBlockAt(x, y, z);
        if (targetTypeId !== BlockRegistry.WATER.getId()) {
            return;
        }

        world.setBlockAt(x, y, z, 0);
        itemstack.typeId = BlockRegistry.ITEM_BUCKET_WATER.getId();
        itemstack.count = Math.max(1, itemstack.count || 1);
    }
}
