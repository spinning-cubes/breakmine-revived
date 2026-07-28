import GuiScreen from "../GuiScreen.js";
import GuiButton from "../widgets/GuiButton.js";
import GuiWorldSlotContainer from "../widgets/GuiWorldSlotContainer.js";
import GuiWorldSlot from "../widgets/GuiWorldSlot.js";
import GuiCreateWorld from "./GuiCreateWorld.js";
import GuiYesNo from "./GuiYesNo.js";

export default class GuiSelectWorld extends GuiScreen {

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
        this.buttonDelete.enabled = bool;
    }

    init() {
        super.init();

        this.worldSlotContainer = new GuiWorldSlotContainer(this, this.saveList);

        this.minecraft.getWorldList().then(list => {
            this.saveList = list;
            this.worldSlotContainer.slotList = this.saveList.map((data, index) =>
                new GuiWorldSlot(
                    {
                        name: data.name || 'Unknown World',
                        date: data.lastPlayed ? new Date(data.lastPlayed).toLocaleDateString() : '',
                        details: (data.worldType || 'normal') + ' - ' + (data.gameMode || 'survival'),
                    },
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
        });

        this.buttonSelect = new GuiButton(this.minecraft, "Play Selected World", this.width / 2 - 154, this.height - 52, 150, 20, () => {
            if (this.selectedWorld !== -1) {
                const world = this.saveList[this.selectedWorld];
                this.minecraft.loadSavedWorld(world.key);
            }
        });
        this.buttonDelete = new GuiButton(this.minecraft, "Delete", this.width / 2 - 154, this.height - 28, 150, 20, () => {
            if (this.selectedWorld !== -1) {
                const world = this.saveList[this.selectedWorld];
                this.minecraft.displayScreen(new GuiYesNo(this, "Are you sure you want to delete this world?", `'${world.name}' will be lost forever! (A long time!)`, "Yes", "No", async () => {
                    await this.minecraft.deleteWorld(world.key);
                    this.saveList = this.saveList.filter(w => w.key !== world.key);
                    this.worldSlotContainer.slotList = this.saveList.map((data, index) =>
                        new GuiWorldSlot(
                            {
                                name: data.name || 'Unknown World',
                                date: data.lastPlayed ? new Date(data.lastPlayed).toLocaleDateString() : '',
                                details: (data.worldType || 'normal') + ' - ' + (data.gameMode || 'survival'),
                            },
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
                    this.selectedWorld = -1;
                    this.worldSlotContainer.selectedWorld = -1;
                    this.buttonSelect.enabled = false;
                    this.buttonDelete.enabled = false;
                }));
            }
        });

        this.buttonList.push(new GuiButton(this.minecraft, "Create New World", this.width / 2 + 4, this.height - 52, 150, 20, () => {
            this.minecraft.displayScreen(new GuiCreateWorld(this));
        }));
        this.buttonList.push(new GuiButton(this.minecraft, "Cancel", this.width / 2 + 4, this.height - 28, 150, 20, () => {
            this.minecraft.displayScreen(this.previousScreen);
        }));
        this.buttonList.push(this.buttonSelect);
        this.buttonList.push(this.buttonDelete);

        this.buttonSelect.enabled = false;
        this.buttonDelete.enabled = false;
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        this.worldSlotContainer.drawScreen(stack, mouseX, mouseY, partialTicks);
        this.drawCenteredString(stack, "Select World", this.width / 2, 20);
        this.drawCenteredString(stack, "World saving is still in development, don't rely on it!", this.width / 2, 5, 0xFF6363);
        super.drawScreen(stack, mouseX, mouseY, partialTicks);
    }

    mouseClicked(mouseX, mouseY, mouseButton) {
        this.worldSlotContainer.mouseClicked(mouseX, mouseY, mouseButton);
        super.mouseClicked(mouseX, mouseY, mouseButton);
    }

    onClose() {
    }
}
