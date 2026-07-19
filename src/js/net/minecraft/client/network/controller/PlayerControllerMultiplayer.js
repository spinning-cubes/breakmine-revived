import PlayerController from "./PlayerController.js";
import PlayerEntityMultiplayer from "../../entity/PlayerEntityMultiplayer.js";
import ClientChatPacket from "../packet/play/client/ClientChatPacket.js";
import ClientPlayerDiggingPacket from "../packet/play/client/ClientPlayerDiggingPacket.js";
import ClientPlayerBlockPlacementPacket from "../packet/play/client/ClientPlayerBlockPlacementPacket.js";

export default class PlayerControllerMultiplayer extends PlayerController {

    constructor(minecraft, networkHandler, entityId) {
        super(minecraft);

        this.entityId = entityId;
        this.networkHandler = networkHandler;
    }

    createPlayer(world) {
        let player = new PlayerEntityMultiplayer(this.minecraft, world, this.networkHandler, this.entityId);
        player.inventory.setItemRenderer(this.minecraft.itemRenderer);
        player.handleInventoryChanged();
        return player;
    }

    sendChatMessage(message) {
        this.networkHandler.sendPacket(new ClientChatPacket(message));
    }

    getNetworkHandler() {
        return this.networkHandler;
    }

    sendBlockDiggingPacket(status, blockPosition, face) {
        this.networkHandler.sendPacket(new ClientPlayerDiggingPacket(status, blockPosition, face));
    }

    sendBlockPlacementPacket(blockPosition, direction, heldItem) {
        this.networkHandler.sendPacket(new ClientPlayerBlockPlacementPacket(blockPosition, direction, heldItem));
    }
}