import Packet from "../../../Packet.js";

export default class ClientDropItemPacket extends Packet {

    constructor(blockId) {
        super();
        this.blockId = blockId;
    }

    write(buffer) {
        buffer.writeShort(this.blockId);
    }
}
