import ItemGeneric from "./ItemGeneric.js";
import { BlockRegistry } from "../BlockRegistry.js";
import Block from "../Block.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";

export default class ItemBucketEmpty extends ItemGeneric {

    constructor(id, textureSlotId, description) {
        super(id, textureSlotId, description);
        this.inventoryTab = EnumCreativeInventoryTab.TOOLS;
    }

    onUse(world, x, y, z, itemstack) {
        if (!world || x === undefined || y === undefined || z === undefined || !itemstack) {
            return;
        }

        const targetTypeId = world.getBlockAt(x, y, z);
        if (targetTypeId !== BlockRegistry.WATER.getId() && targetTypeId !== BlockRegistry.LAVA.getId()) {
            return;
        }

        const block = Block.getById(targetTypeId);
        world.setBlockAt(x, y, z, 0);
        itemstack.typeId = block === BlockRegistry.WATER ? BlockRegistry.ITEM_BUCKET_WATER.getId() : BlockRegistry.ITEM_BUCKET_LAVA.getId();
        itemstack.count = Math.max(1, itemstack.count || 1);
    }
}
