import ItemGeneric from "./ItemGeneric.js";
import { BlockRegistry } from "../BlockRegistry.js";
import Block from "../Block.js";

export default class ItemBucketWater extends ItemGeneric {

    constructor(id, textureSlotId, description) {
        super(id, textureSlotId, description);
    }

    onUse(world, x, y, z, itemstack) {
        if (!world || x === undefined || y === undefined || z === undefined || !itemstack) {
            return;
        }

        const targetTypeId = world.getBlockAt(x, y, z);
        const targetBlock = Block.getById(targetTypeId);
        const canPlace = targetTypeId === 0 || (targetBlock && targetBlock.isReplaceable(world, x, y, z) && targetTypeId !== BlockRegistry.WATER.getId() && targetTypeId !== BlockRegistry.LAVA.getId());

        if (!canPlace) {
            return;
        }

        world.setBlockAt(x, y, z, BlockRegistry.WATER.getId());
        itemstack.typeId = BlockRegistry.ITEM_BUCKET_EMPTY.getId();
        itemstack.count = Math.max(1, itemstack.count || 1);
    }
}
