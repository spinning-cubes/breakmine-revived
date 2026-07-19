import GuiScreen from "../GuiScreen.js";
import GuiButton from "../widgets/GuiButton.js";
import GuiSwitchButton from "../widgets/GuiSwitchButton.js";
import GuiSliderButton from "../widgets/GuiSliderButton.js";
import GuiFovSliderButton from "../widgets/GuiFovSliderButton.js";
import GuiControls from "./GuiControls.js";

export default class GuiOptions extends GuiScreen {

    constructor(previousScreen) {
        super();

        this.pauseGame = true;
        this.previousScreen = previousScreen;
    }

    init() {
        super.init();

        let settings = this.minecraft.settings;

        let y = this.height / 2 - 50;
        this.buttonList.push(new GuiSwitchButton("Ambient Occlusion", settings.ambientOcclusion, this.width / 2 - 100, y, 200, 20, value => {
            settings.ambientOcclusion = value;
            this.minecraft.worldRenderer.rebuildAll();
        }).setTooltip("Shades the edges where blocks meet"));
        this.buttonList.push(new GuiSwitchButton("View Bobbing", settings.viewBobbing, this.width / 2 - 100, y + 24, 200, 20, value => {
            settings.viewBobbing = value;
        }).setTooltip("Makes camera bob up and down when moving"));
        this.buttonList.push(new GuiFovSliderButton("FOV", settings.fov, 50, 200, this.width / 2 - 100, y + 24 * 2, 200, 20, value => {
            settings.fov = value;
        }));
        this.buttonList.push(new GuiSliderButton("Render Distance", settings.viewDistance, 2, 16, this.width / 2 - 100, y + 24 * 3, 200, 20, value => {
            settings.viewDistance = value;
        }));
        this.buttonList.push(new GuiButton(this.minecraft, "Controls...", this.width / 2 - 100, y + 24 * 4, 200, 20, () => {
            this.minecraft.displayScreen(new GuiControls(this));
        }));

        this.buttonList.push(new GuiButton(this.minecraft, "Done", this.width / 2 - 100, y + 130, 200, 20, () => {
            this.minecraft.displayScreen(this.previousScreen);
        }));
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        // Background
        this.drawDefaultBackground(stack);

        // Title
        this.drawCenteredString(stack, "Settings", this.width / 2, 50);

        super.drawScreen(stack, mouseX, mouseY, partialTicks);
    }

    onClose() {
        // Save settings
        this.minecraft.settings.save();
    }

}