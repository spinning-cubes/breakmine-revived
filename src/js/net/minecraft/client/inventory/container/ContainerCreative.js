import Container from "../Container.js";
import GuiContainerCreative from "../../gui/screens/container/GuiContainerCreative.js";
import Slot from "../Slot.js";
import Block from "../../world/block/Block.js";
import InventoryPlayer from "../inventory/InventoryPlayer.js";
import ItemStack from "../../item/ItemStack.js";


export default class ContainerCreative extends Container {

    static ITEMS_PER_PAGE = 45;

    constructor(player) {
        super();

        this.itemList = [];
        this.currentPage = 0;
        this.totalPages = 1;

        let playerInventory = player.inventory;

        // Add creative inventory slots
        for (let y = 0; y < 5; ++y) {
            for (let x = 0; x < 9; ++x) {
                this.addSlot(new Slot(GuiContainerCreative.inventory, y * 9 + x, 9 + x * 18, 18 + y * 18));
            }
        }

        // Add player hotbar
        for (let x = 0; x < 9; ++x) {
            this.addSlot(new Slot(playerInventory, x, 9 + x * 18, 112));
        }

        this.initItems();
        this.goToPage(0);
    }

    swapWithHotbar(slot, inventoryPlayer, hotbarIndex) {
        let slotInventory = slot.inventory;
        let slotItem = slotInventory.getItemInSlot(slot.index).copy();

        inventoryPlayer.setItem(hotbarIndex, slotItem);

        this.dirty = true;
    }

    onSlotClick(slot, player, mouseButton = 0) {
        if (slot.inventory instanceof InventoryPlayer) {
            super.onSlotClick(slot, player, mouseButton);
        } else {
            let inventoryPlayer = player.inventory;
            let slotItem = slot.inventory.getItemInSlot(slot.index);
            let cursorItem = slotItem.copy();
            cursorItem.setCount(mouseButton === 1 ? cursorItem.getMaxStackSize() : 1);
            inventoryPlayer.itemInCursor = cursorItem;
        }
        this.dirty = true;
    }

    scrollTo(scrollOffset) {

    }

    goToPage(page) {
        this.currentPage = Math.max(0, Math.min(page, this.totalPages - 1));
        let startIndex = this.currentPage * ContainerCreative.ITEMS_PER_PAGE;

        for (let y = 0; y < 5; ++y) {
            for (let x = 0; x < 9; ++x) {
                let index = startIndex + x + y * 9;

                if (index >= 0 && index < this.itemList.length) {
                    GuiContainerCreative.inventory.setItem(x + y * 9, this.itemList[index]);
                } else {
                    GuiContainerCreative.inventory.setItem(x + y * 9, null);
                }
            }
        }
    }


    initItems() {
        Block.blocks.forEach((block) => {
            this.itemList.push(block.getId());
        });
        this.totalPages = Math.ceil(this.itemList.length / ContainerCreative.ITEMS_PER_PAGE);
    }
}