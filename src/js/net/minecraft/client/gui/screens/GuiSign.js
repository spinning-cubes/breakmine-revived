import GuiScreen from "../GuiScreen.js";
import GuiButton from "../widgets/GuiButton.js";
import GuiTextField from "../widgets/GuiTextField.js";

export default class GuiSign extends GuiScreen {

    constructor(player, blockPosition) {
        super();
        this.player = player;
        this.blockPosition = blockPosition;
        this.signText = "";
    }

    init() {
        super.init();

        // Load existing sign text if any
        if (this.player.world && this.player.world.blockInventories) {
            const key = `${this.blockPosition.x},${this.blockPosition.y},${this.blockPosition.z}`;
            const signData = this.player.world.blockInventories.get(key);
            if (signData && signData.text) {
                this.signText = signData.text;
            }
        }

        // Text field for sign content
        this.textField = new GuiTextField(this.width / 2 - 100, this.height / 2 - 10, 200, 20);
        this.textField.setText(this.signText);
        this.textField.maxLength = 100;
        this.textField.isFocused = true;
        this.buttonList.push(this.textField);

        // Save button
        this.buttonSave = new GuiButton(this.minecraft, "Save", this.width / 2 - 50, this.height / 2 + 20, 100, 20, () => {
            this.saveSign();
        });
        this.buttonList.push(this.buttonSave);
    }

    saveSign() {
        this.signText = this.textField.getText();
        
        // Store sign text in world
        if (this.player.world) {
            if (!this.player.world.blockInventories) {
                this.player.world.blockInventories = new Map();
            }
            
            const key = `${this.blockPosition.x},${this.blockPosition.y},${this.blockPosition.z}`;
            this.player.world.blockInventories.set(key, {
                text: this.signText
            });
        }

        // Close the GUI
        this.minecraft.displayScreen(null);
    }

    drawScreen(stack, mouseX, mouseY, partialTicks) {
        this.drawDefaultBackground(stack);
        
        // Draw title
        this.drawCenteredString(stack, "Sign Editor", this.width / 2, this.height / 2 - 40);
        
        super.drawScreen(stack, mouseX, mouseY, partialTicks);
    }

    keyTyped(key, character) {
        super.keyTyped(key, character);
        
        // Allow saving with Enter key
        if (key === "Enter") {
            this.saveSign();
            return true;
        }
        
        // Allow closing with Escape
        if (key === "Escape") {
            this.minecraft.displayScreen(null);
            return true;
        }
        
        return false;
    }
}
