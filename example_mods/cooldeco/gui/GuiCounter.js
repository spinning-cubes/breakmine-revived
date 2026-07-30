import GuiContainer from "../../GuiContainer.js";
import Container from "../Container.js";
import Slot from "../Slot.js";

class ContainerCounter extends Container {

    constructor(player, blockPosition = null) {
        super();

        this.minecraft = player.minecraft;
        this.tileEntity = this.getBlockInventory(player, blockPosition, 1, "counter");

        let playerInventory = player.inventory;

        this.addSlot(new Slot(this.tileEntity, 0, 80, 35));

        for (let y = 0; y < 3; ++y) {
            for (let x = 0; x < 9; ++x) {
                this.addSlot(new Slot(playerInventory, (y * 9 + x) + 9, 8 + x * 18, 84 + y * 18));
            }
        }

        for (let x = 0; x < 9; ++x) {
            this.addSlot(new Slot(playerInventory, x, 8 + x * 18, 142));
        }
    }

    onSlotClick(slot, player, mouseButton = 0) {
        super.onSlotClick(slot, player, mouseButton);
        this.dirty = true;
    }
}

export default class GuiCounter extends GuiContainer {

    constructor(player, blockPosition = null) {
        super(new ContainerCounter(player, blockPosition));

        this.inventoryWidth = 176;
        this.inventoryHeight = 166;
    }

    init() {
        this.textureInventory = this.getTexture("gui/container/inventory.png");
        super.init();
    }

    drawTitle(stack) {
        this.drawString(stack, "Counter", this.x + 8, this.y + 6, 0xff404040, false);
    }

    drawInventoryBackground(stack) {
        this.drawSprite(
            stack,
            this.textureInventory,
            0,
            0,
            this.inventoryWidth,
            this.inventoryHeight,
            this.x,
            this.y,
            this.inventoryWidth,
            this.inventoryHeight
        );
    }

    keyTyped(key, character) {
        if (key === this.minecraft.settings.keyOpenInventory) {
            this.minecraft.displayScreen(null);
            return true;
        }
        return super.keyTyped(key, character);
    }
}
