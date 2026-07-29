import GuiButton from "./GuiButton.js";

export default class GuiModSlot extends GuiButton {

    constructor(modData, x, y, width, height, callback, minecraft) {
        super(minecraft, modData.name, x, y, width, height, callback);

        this.modName = modData.name;
        this.modId = modData.id;
        this.modVersion = modData.version;
        this.modAuthor = modData.author;
        this.modEnabled = modData.enabled;

        this.drawButton = () => {};
        this.renderE = true;
    }

    render(stack, mouseX, mouseY, partialTicks) {
        if (!this.renderE) return;

        const slotX = this.x;
        const slotY = this.y;
        const slotW = this.width;

        const WHITE = 16777215;
        const GRAY = 8421504;
        const DARK_GRAY = 5592405;

        const nameColor = this.modEnabled ? WHITE : DARK_GRAY;
        this.drawString(stack, this.modName, slotX + 2, slotY + 1, nameColor, true, false);

        this.drawString(stack, `${this.modId} v${this.modVersion}`, slotX + 2, slotY + 12, GRAY, true, false);

        const authorStr = `by ${this.modAuthor}`;
        this.drawString(stack, authorStr, slotX + slotW - 2 - this.getStringWidth(stack, authorStr), slotY + 1, GRAY, true, false);

        const statusStr = this.modEnabled ? "[ON]" : "[OFF]";
        const statusColor = this.modEnabled ? 5635925 : 16733525;
        this.drawString(stack, statusStr, slotX + slotW - 2 - this.getStringWidth(stack, statusStr), slotY + 12, statusColor, true, false);
    }

    mouseClicked(mouseX, mouseY, mouseButton) {
        if (this.isMouseOver(mouseX, mouseY)) {
            this.callback();
        }
    }
}
