import GuiScreen from "../GuiScreen.js";
import GuiButton from "../widgets/GuiButton.js";
import GuiModSlotContainer from "../widgets/GuiModSlotContainer.js";
import GuiModSlot from "../widgets/GuiModSlot.js";
import FileSystem from "../../fs/Filesystem.js";

export default class GuiMods extends GuiScreen {

    constructor(minecraft, previousScreen) {
        super();
        this.minecraft = minecraft;
        this.previousScreen = previousScreen;
        this.mods = [];
        this.modSlotContainer = null;
        this.selectedIndex = -1;
    }

    setSelectedWorld(index) {
        this.selectedIndex = index;
        this.updateButtonStates();
    }

    rebuildSlotList() {
        if (!this.modSlotContainer) return;
        this.modSlotContainer.slotList = this.mods.map((data, index) =>
            new GuiModSlot(
                data, 5, 0, this.width - 10, 36,
                () => { this.modSlotContainer.setSelected(index); },
                this.minecraft
            )
        );
    }

    async init() {
        super.init();

        await this.refreshModList();

        this.modSlotContainer = new GuiModSlotContainer(this, this.mods);
        this.rebuildSlotList();

        this.buttonUpload = new GuiButton(this.minecraft, "Upload Mod (.zip)", this.width / 2 - 155, this.height - 52, 150, 20, () => {
            this.uploadMod();
        });

        this.buttonToggle = new GuiButton(this.minecraft, "Toggle", this.width / 2 + 5, this.height - 52, 150, 20, async () => {
            if (this.selectedIndex < 0 || this.selectedIndex >= this.mods.length) return;
            const mod = this.mods[this.selectedIndex];
            const newState = !mod.enabled;
            await this.minecraft.modLoader.toggleMod(mod.id, newState);
            await this.refreshModList();
            this.rebuildSlotList();
            this.updateButtonStates();
        });

        this.buttonDelete = new GuiButton(this.minecraft, "Delete", this.width / 2 - 155, this.height - 28, 150, 20, async () => {
            if (this.selectedIndex < 0 || this.selectedIndex >= this.mods.length) return;
            const mod = this.mods[this.selectedIndex];
            if (confirm(`Delete mod "${mod.name}" by ${mod.author}?`)) {
                await this.minecraft.modLoader.uninstallMod(mod.id);
                await this.refreshModList();
                this.rebuildSlotList();
                this.selectedIndex = -1;
                this.updateButtonStates();
            }
        });

        this.buttonList.push(this.buttonUpload);
        this.buttonList.push(this.buttonToggle);
        this.buttonList.push(this.buttonDelete);

        this.buttonList.push(new GuiButton(this.minecraft, "Back", this.width / 2 + 5, this.height - 28, 150, 20, () => {
            this.minecraft.displayScreen(this.previousScreen);
        }));

        this.updateButtonStates();
    }

    updateButtonStates() {
        const hasSelection = this.selectedIndex >= 0 && this.selectedIndex < this.mods.length;
        this.buttonToggle.enabled = hasSelection;
        this.buttonDelete.enabled = hasSelection;

        if (hasSelection) {
            const mod = this.mods[this.selectedIndex];
            this.buttonToggle.name = mod.enabled ? "Disable" : "Enable";
        } else {
            this.buttonToggle.name = "Toggle";
        }
    }

    async refreshModList() {
        if (!this.minecraft.modLoader) return;
        this.mods = await this.minecraft.modLoader.getInstalledMods();
    }

    uploadMod() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await this.minecraft.modLoader.installModFromZip(file);
                await this.refreshModList();
                this.rebuildSlotList();
                this.selectedIndex = this.mods.length - 1;
                this.updateButtonStates();
            } catch (err) {
                alert('Failed to install mod: ' + err.message);
            }
        };
        input.click();
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        this.drawDefaultBackground(stack);
        this.drawCenteredString(stack, "Mods", this.width / 2, 16);

        if (this.mods.length === 0) {
            this.drawCenteredString(stack, "No mods installed.", this.width / 2, this.height / 2 - 10);
            this.drawCenteredString(stack, "Upload a .zip mod file to get started.", this.width / 2, this.height / 2 + 10);
        } else if (this.modSlotContainer) {
            this.modSlotContainer.drawScreen(stack, mouseX, mouseY, partialTicks);
        }

        super.drawScreen(stack, mouseX, mouseY, partialTicks);
    }

    mouseClicked(mouseX, mouseY, mouseButton) {
        if (this.modSlotContainer) {
            this.modSlotContainer.mouseClicked(mouseX, mouseY, mouseButton);
        }
        super.mouseClicked(mouseX, mouseY, mouseButton);
    }

    mouseScrolled(mouseX, mouseY, delta) {
        if (this.modSlotContainer) {
            this.modSlotContainer.mouseScrolled(mouseX, mouseY, delta);
        }
    }

    keyTyped(key, character) {
        if (key === "Escape") {
            this.minecraft.displayScreen(this.previousScreen);
            return true;
        }
        return super.keyTyped(key, character);
    }

    onClose() {

    }
}
