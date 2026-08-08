import Packet from "../../../Packet.js";

export default class ClientDropItemPacket extends Packet {

    constructor(blockId, x, y, z) {
        super();
        this.blockId = blockId;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    write(buffer) {
        buffer.writeShort(this.blockId);
        buffer.writeInt(this.x);
        buffer.writeInt(this.y);
        buffer.writeInt(this.z);
    }
}
