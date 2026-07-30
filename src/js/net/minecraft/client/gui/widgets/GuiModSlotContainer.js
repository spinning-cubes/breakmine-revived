import GuiWorldSlotContainer from "./GuiWorldSlotContainer.js";
import GuiModSlot from "./GuiModSlot.js";

export default class GuiModSlotContainer extends GuiWorldSlotContainer {

    constructor(parentGui, modList) {
        super(parentGui, modList);

        this.slotList = modList.map((data, index) =>
            new GuiModSlot(
                data,
                5,
                0,
                parentGui.width - 10,
                36,
                () => {
                    this.setSelected(index);
                },
                parentGui.minecraft
            )
        );
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        const listTop = this.top;
        const listBottom = this.bottom;
        const slotWidth = this.parentGui.width - 10;

        stack.save();

        stack.beginPath();
        stack.rect(0, listTop, this.parentGui.width, listBottom - listTop);
        stack.clip();

        let currentY = listTop + 7 - this.amountScrolled;

        this.drawBackgroundPart(stack, this.top, this.bottom);

        for (let i = 0; i < this.slotList.length; i++) {
            const slot = this.slotList[i];
            const slotHeight = this.slotHeight;
            const slotTop = currentY + (i * (slotHeight + 2));
            const slotBottom = slotTop + slotHeight;
            const slotLeft = 5;
            const slotRight = slotLeft + slotWidth;

            if (slotBottom >= listTop && slotTop <= listBottom) {
                if (i === this.selectedWorld) {
                    this.parentGui.drawRect(stack, slotLeft - 1, slotTop - 3, slotRight + 1, slotBottom - 1, "rgb(153, 153, 153)");
                    this.parentGui.drawRect(stack, slotLeft, slotTop - 2, slotRight, slotBottom - 2, "rgba(0, 0, 0)");
                }

                slot.x = slotLeft;
                slot.y = slotTop;
                slot.width = slotWidth;
                slot.height = slotHeight;
                if (!slot.minecraft && this.parentGui.minecraft) {
                    slot.minecraft = this.parentGui.minecraft;
                }
                slot.render(stack, mouseX, mouseY, partialTicks);
            }
        }

        stack.restore();
    }

    drawBackgroundPart(stack, top, bottom) {
        this.parentGui.drawRect(stack, 0, top, this.parentGui.width, bottom, "rgba(0, 0, 0, 0.5)");
    }

    mouseScrolled(mouseX, mouseY, delta) {
        const maxScroll = Math.max(0, this.slotList.length * (this.slotHeight + 2) - (this.bottom - this.top));
        this.amountScrolled -= delta > 0 ? 12 : -12;
        this.amountScrolled = Math.max(0, Math.min(this.amountScrolled, maxScroll));
    }
}
