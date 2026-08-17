import ItemGeneric from "./ItemGeneric.js";
import { BlockRegistry } from "../BlockRegistry.js";
import Block from "../Block.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";
import BlockPosition from "../../../../util/BlockPosition.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class ItemBucketEmpty extends ItemGeneric {

    constructor(id, textureSlotId, description) {
        super(id, textureSlotId, description);
        this.inventoryTab = EnumCreativeInventoryTab.TOOLS;
    }

    onUse(world, x, y, z, itemstack, hitFace) {
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
        this.notifyServerPlacement(world, x, y, z, hitFace, block === BlockRegistry.WATER ? BlockRegistry.WATER.getId() : BlockRegistry.LAVA.getId());
    }

    notifyServerPlacement(world, x, y, z, hitFace, blockId) {
        const minecraft = world.minecraft;
        if (!minecraft || !minecraft.playerController ||
            typeof minecraft.playerController.sendBlockPlacementPacket !== 'function') {
            return;
        }
        minecraft.playerController.sendBlockPlacementPacket(
            new BlockPosition(x - hitFace.x, y - hitFace.y, z - hitFace.z),
            minecraft.getFaceValue(hitFace),
            { id: blockId }
        );
    }
}
