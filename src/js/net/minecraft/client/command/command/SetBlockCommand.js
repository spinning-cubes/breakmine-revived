import Command from "../Command.js";

export default class SetBlockCommand extends Command {

    constructor() {
        super("setblock", "<x> <y> <z> <id>", "Sets a block")
    }

    execute(minecraft, args) {
        if (args.length !== 4) {
            return false;
        }

        let x = parseInt(args[0]);
        let y = parseInt(args[1]);
        let z = parseInt(args[2]);

        let block = parseInt(args[3]);

        if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(block)) {
            return false;
        }

        minecraft.world.setBlockAt(x, y, z, block);
        minecraft.addMessageToChat("Set block to " + block + " at " + x + " " + y + " " + z);

        return true;
    }

}