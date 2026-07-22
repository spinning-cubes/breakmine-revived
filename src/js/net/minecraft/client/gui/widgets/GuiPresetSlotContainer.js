import GuiWorldSlotContainer from "./GuiWorldSlotContainer.js";
import GuiWorldPresetSlot from "./GuiWorldPresetSlot.js";

export default class GuiPresetSlotContainer extends GuiWorldSlotContainer {

    constructor(parentGui, listContent) {
        super(parentGui, listContent);

        this.slotList = listContent.map((data, index) =>
            new GuiWorldPresetSlot(
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
        this.parentGui.drawBackground(stack, this.parentGui.getTexture("gui/background.png"), this.parentGui.width, this.parentGui.height);

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
}
