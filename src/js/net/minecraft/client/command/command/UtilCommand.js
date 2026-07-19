import Command from "../Command.js";
import FontRenderer from "../../render/gui/FontRenderer.js";
import Sublevel from "../../world/sublevel/Sublevel.js";

export default class UtilCommand extends Command {

    constructor() {
        super("util", "", "Testing utilities")
    }

    execute(minecraft, args) {
        let sublevel = new Sublevel(minecraft, minecraft.player.x, minecraft.player.y, minecraft.player.z);
        sublevel.world.setBlockAt(0, 0, 0, 1);
        sublevel.world.setBlockAt(0, 1, 0, 1);
        sublevel.world.setBlockAt(0, 0, 1, 1);
        sublevel.updateGroup();
        minecraft.world.group.add(sublevel.group);
        return true;
    }

}