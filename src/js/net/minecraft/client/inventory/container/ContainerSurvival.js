import Container from "../Container.js";
import Slot from "../Slot.js";
import Block from "../../world/block/Block.js";
import GuiContainerSurvival from "../../gui/screens/container/GuiContainerSurvival.js";
import ItemStack from "../../item/ItemStack.js";
import CraftingRegistry from "../../crafting/CraftingRegistry.js";

export default class ContainerSurvival extends Container {

    constructor(player) {
        super();

        this.itemList = [];
        this.minecraft = player.minecraft;
        let playerInventory = player.inventory;

        // Add crafting slots (lazy)
        let offset = 46;
        this.addSlot(new Slot(playerInventory, offset + 0, 100 - 12, 26)); // top left, 46
        this.addSlot(new Slot(playerInventory, offset + 1, 100 + 6, 26));  // top right, 47
        this.addSlot(new Slot(playerInventory, offset + 2, 100 - 12, 44)); // bottom left, 48
        this.addSlot(new Slot(playerInventory, offset + 3, 100 + 6, 44));  // bottom right, 49

        // Add crafting result slot
        this.addSlot(new Slot(playerInventory, offset + 4, 144, 36)); // 50

        // Add inventory slots
        for (let y = 0; y < 3; ++y) {
            for (let x = 0; x < 9; ++x) {
                this.addSlot(new Slot(playerInventory, (y * 9 + x) + 9, 8 + x * 18, 84 + y * 18));
            }
        }

        // Add player hotbar
        for (let x = 0; x < 9; ++x) {
            this.addSlot(new Slot(playerInventory, x, 8 + x * 18, 142));
        }

        this.initItems();
        this.scrollTo(0);
        this.refreshCraftingResult();
    }

    refreshCraftingResult() {
        const playerInventory = this.minecraft?.player?.inventory;
        if (!playerInventory) {
            return;
        }

        // Purely visual preview logic
        const result = CraftingRegistry.getCraftResult([
            playerInventory.getItemInSlot(46),
            playerInventory.getItemInSlot(47),
            playerInventory.getItemInSlot(48),
            playerInventory.getItemInSlot(49)
        ], 2, 2);

        if (result) {
            playerInventory.setItem(50, result);
        } else {
            playerInventory.setItem(50, new ItemStack(0, 0));
        }
    }

    onSlotClick(slot, player, mouseButton = 0) {
        // Check if the clicked slot is the crafting result slot
        if (slot.inventory === player.inventory && slot.index === 50) {
            const resultItem = player.inventory.getItemInSlot(50);
            if (!resultItem.isEmpty()) {
                const accepted = player.inventory.addItem(resultItem.getType(), resultItem.getCount());
                if (accepted) {
                    // Consume exactly 1 item from each grid slot upon successful click
                    for (let i = 46; i <= 49; i++) {
                        const item = player.inventory.getItemInSlot(i);
                        if (item && !item.isEmpty()) {
                            item.shrink(1);
                        }
                    }
                    player.inventory.setItem(50, new ItemStack(0, 0));
                }
            }
        } else {
            super.onSlotClick(slot, player, mouseButton);
        }

        this.refreshCraftingResult();
        this.dirty = true;
    }

    swapWithHotbar(slot, inventoryPlayer, hotbarIndex) {
        if ([50].includes(slot.index)) return;
        let slotInventory = slot.inventory;
        let slotItem = slotInventory.getItemInSlot(slot.index).copy();

        inventoryPlayer.setItem(hotbarIndex, slotItem);

        this.dirty = true;
    }

    scrollTo(scrollOffset) {
        let xOffset = (this.itemList.length + 9 - 1) / 9 - 5;
        let yOffset = Math.floor((scrollOffset * xOffset) + 0.5);

        if (yOffset < 0) {
            yOffset = 0;
        }

        for (let y = 0; y < 5; ++y) {
            for (let x = 0; x < 9; ++x) {
                let index = x + (y + yOffset) * 9;

                if (index >= 0 && index < this.itemList.length) {
                    GuiContainerSurvival.inventory.setItem(x + y * 9, this.itemList[index]);
                } else {
                    GuiContainerSurvival.inventory.setItem(x + y * 9, null);
                }
            }
        }
    }

    initItems() {
        // Fill inventory with blocks
        Block.blocks.forEach((block) => {
            // InventoryBasic.setItem expects an ItemStack/number, not ids/strings.
            // Block ids are numeric in this project.
            this.itemList.push(block.getId());
        });

        // Add default tools as ItemStacks so InventoryBasic.setItem doesn't crash.
        // Tools are keyed by ToolRegistry type ids.
        this.itemList.push(new ItemStack(this.minecraft?.world?.tools ? this.minecraft.world.tools.IRON_PICKAXE : 'iron_pickaxe', 1));
        this.itemList.push(new ItemStack('iron_sword', 1));
        this.itemList.push(new ItemStack('iron_shovel', 1));
        this.itemList.push(new ItemStack('iron_axe', 1));
        this.itemList.push(new ItemStack('iron_hoe', 1));
    }
}