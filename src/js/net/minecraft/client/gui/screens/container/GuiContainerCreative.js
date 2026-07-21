import GuiContainer from "../GuiContainer.js";
import ContainerCreative from "../../../inventory/container/ContainerCreative.js";
import InventoryBasic from "../../../inventory/inventory/InventoryBasic.js";
import GuiButton from "../../widgets/GuiButton.js";

export default class GuiContainerCreative extends GuiContainer {

    static inventory = new InventoryBasic();

    constructor(player) {
        super(new ContainerCreative(player));

        this.inventoryWidth = 195;
        this.inventoryHeight = 148;
    }

    init() {
        this.textureInventory = this.getTexture("gui/container/creative.png");

        super.init();

        // Navigation buttons below inventory
        let navY = this.y + this.inventoryHeight + 4 - 22;

        let leftButton = new GuiButton(
            this.minecraft, "<",
            this.x + 8, navY,
            20, 14,
            () => {
                this.container.goToPage(this.container.currentPage - 1);
                this.container.dirty = true;
                this.updatePageButtons();
            }
        );

        let rightButton = new GuiButton(
            this.minecraft, ">",
            (this.x + 188) - 20, navY,
            20, 14,
            () => {
                this.container.goToPage(this.container.currentPage + 1);
                this.container.dirty = true;
                this.updatePageButtons();
            }
        );

        this.buttonList.push(leftButton);
        this.buttonList.push(rightButton);

        this.leftButton = leftButton;
        this.rightButton = rightButton;

        this.updatePageButtons();
    }

    updatePageButtons() {
        this.leftButton.setEnabled(this.container.currentPage > 0);
        this.rightButton.setEnabled(this.container.currentPage < this.container.totalPages - 1);
    }

    drawTitle(stack) {
        this.drawString(stack, "Creative Inventory", this.x + 8, this.y + 6, 0xff404040, false, false);

        // Draw page number below inventory
        let pageText = (this.container.currentPage + 1) + " / " + this.container.totalPages;
        let centerX = this.x + Math.floor(this.inventoryWidth / 2);
        this.drawString(stack, pageText, centerX - this.getStringWidth(stack, pageText) / 2, this.y + this.inventoryHeight + 8 - 22, 0xff404040, false);
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