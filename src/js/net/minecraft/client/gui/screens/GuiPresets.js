import GuiScreen from "../GuiScreen.js";
import GuiButton from "../widgets/GuiButton.js";
import GuiDirectConnect from "./GuiDirectConnect.js";
import GuiConnecting from "./GuiConnecting.js";
import GuiYesNo from "./GuiYesNo.js";
import Minecraft from "../../Minecraft.js";
import GuiWorldPresetSlotContainer from "../widgets/GuiWorldPresetSlot.js";
import GuiWorldSlot from "../widgets/GuiWorldSlot.js";

export default class GuiPresets extends GuiScreen {

    constructor(previousScreen) {
        super();

        this.previousScreen = previousScreen;
        this.worldSlotContainer = null;
        this.saveList = []; 
        this.selectedWorld = -1;
    }
    
    setSelectedWorld(index) {
        this.selectedWorld = index;
        const bool = (index >= 0 && index < this.saveList.length);
        this.buttonSelect.enabled = bool;
    }

    init() {
        super.init();

        // Only initialize saveList if it's empty (prevents duplicate loading on re-init)
        if (!this.saveList) {
            this.saveList = [];
        }

        this.saveList = [
            {
                name: "The Burrow",
                details: "A circle of land enclosed by some semi-floating land above it.",
                worldType: "default",
                seed: "-5529091579467429620"
            },
            {
                name: "Flatness",
                details: "A very bare spawn area with no trees and flat hills.",
                worldType: "default",
                seed: "-5855597882444181042"
            }
        ]

        this.worldSlotContainer = new GuiWorldPresetSlotContainer(this, this.saveList);
        this.beenAdded = [];
        this.lanBeenAdded = [];

        // Update slot positions for current window size (fixes disappearing on resize)
        this.worldSlotContainer.slotList = this.saveList.map((data, index) =>
            new GuiWorldSlot(
                data,
                this.width / 2 - 110,
                0,
                220,
                36,
                () => {
                    this.worldSlotContainer.setSelected(index);
                },
                this.minecraft
            )
        );

        this.buttonSelect = new GuiButton(this.minecraft, "Select this Preset", this.width / 2 - 155, this.height - 28, 150, 20, () => {
            if (this.selectedWorld !== -1) {
                const world = this.worldSlotContainer.slotList[this.selectedWorld];
                const worldName = world.worldName.replaceAll(' ', '_').replaceAll('/', '_');
                const worldNameNonSafe = world.worldName;
                const worldDetails = world.worldDetails;
                const worldDate = world.worldDate.replaceAll(' ', '_').replaceAll('/', '_');
                console.log(`loading server '${worldName}'...`);

                // Use the proxy field as the WebSocket address
                let proxy = null;
                if (worldDetails && worldDetails.trim() !== '') {
                    let proxyUrl = worldDetails.trim();
                    // If it has the "Proxy: " prefix, remove it
                    if (proxyUrl.startsWith('Proxy: ')) {
                        proxyUrl = proxyUrl.replace('Proxy: ', '').trim();
                    }
                    proxy = { url: `ws://${proxyUrl}` };
                } else {
                    // Auto-detect: use proxy if not localhost or 10.0.0.213
                    let address = worldDate.trim().toLowerCase();
                    let isLocalhost = address === 'localhost' || address === '127.0.0.1' || address.startsWith('127.0.0.');
                    let isAllowedHost = address === '10.0.0.213';
                    
                    if (!isLocalhost && !isAllowedHost) {
                        proxy = { url: 'ws://174.169.230.116:6003' };
                    }
                }

                this.minecraft.displayScreen(new GuiConnecting(this, worldDate, undefined, proxy));
            }
        });
        this.buttonList.push(new GuiButton(this.minecraft, "Cancel", this.width / 2 + 5, this.height - 28, 150, 20, () => {
            this.minecraft.displayScreen(this.previousScreen);
        }));
        this.buttonList.push(this.buttonSelect);
        this.buttonSelect.enabled = false;
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        this.worldSlotContainer.drawScreen(stack, mouseX, mouseY, partialTicks);
        this.drawCenteredString(stack, "Play Multiplayer", this.width / 2, 20);
        this.drawCenteredString(stack, "Multiplayer is still in development, expect bugs and breaking changes.", this.width / 2, 5, 0xFF6363);
        super.drawScreen(stack, mouseX, mouseY, partialTicks);
    }
    
    mouseClicked(mouseX, mouseY, mouseButton) {
        this.worldSlotContainer.mouseClicked(mouseX, mouseY, mouseButton);
        super.mouseClicked(mouseX, mouseY, mouseButton); 
    }

    onClose() {

    }
}