import Command from "../Command.js";

export default class GameModeCommand extends Command {

    constructor() {
        super("gamemode", "<survival|creative  0|1>", "Change game mode")
    }

    execute(minecraft, args) {
        if (args.length !== 1) {
            return false;
        }

        let mode = args[0].toLowerCase();
        if (mode === "survival" || mode === "0") {
            minecraft.player.creative = false;
            minecraft.player.flying = false;
            minecraft.musicManager.switchWhenReady('game');
            minecraft.addMessageToChat("Game mode changed to Survival");
        } else if (mode === "creative" || mode === "1") {
            minecraft.player.creative = true;
            minecraft.player.flying = true;
            minecraft.musicManager.switchWhenReady('creative');
            minecraft.addMessageToChat("Game mode changed to Creative");
        } else {
            return false;
        }

        return true;
    }

}