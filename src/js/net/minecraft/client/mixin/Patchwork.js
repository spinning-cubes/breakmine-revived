import { Version } from "../../../../../resources/version.js";

// static; no 'this' allowed.
export default class Patchwork {
    static version = Version.PATCHWORK_VERSION;
    static timestamp = Version.TIMESTAMP;

    static block = class BlockManager {
        //
    }

    static entity = class EntityManager {
        //
    }

    static game = class GameManager {
        //
    }

    static world = class WorldManager {
        //
    }

    static renderer = class RendererManager {
        //
    }

    static gui = class GuiManager {
        //
    }
}