function readVarInt(buffer, offset) {
    let value = 0;
    let length = 0;
    let currentByte;
    do {
        currentByte = buffer.readUInt8(offset + length);
        value |= (currentByte & 0x7F) << (length * 7);
        length++;
        if (length > 5) {
            throw new Error('VarInt too big');
        }
    } while ((currentByte & 0x80) !== 0);
    return [value, length];
}

function writeVarInt(buffer, value, offset) {
    let byteCount = 0;
    while (true) {
        if ((value & ~0x7F) === 0) {
            buffer.writeUInt8(value, offset + byteCount);
            byteCount++;
            break;
        }
        buffer.writeUInt8((value & 0x7F) | 0x80, offset + byteCount);
        byteCount++;
        value >>>= 7;
    }
    return byteCount;
}

function readString(buffer, offset) {
    const [length, lenBytes] = readVarInt(buffer, offset);
    const str = buffer.toString('utf8', offset + lenBytes, offset + lenBytes + length);
    return [str, lenBytes + length];
}

function writeString(buffer, str, offset) {
    const strLen = Buffer.byteLength(str);
    const lenBytes = writeVarInt(buffer, strLen, offset);
    buffer.write(str, offset + lenBytes, 'utf8');
    return lenBytes + strLen;
}

function makePacket(packetId, dataBuffer) {
    const idBuffer = Buffer.alloc(5);
    const idLen = writeVarInt(idBuffer, packetId, 0);
    
    const packetLength = idLen + dataBuffer.length;
    const lenBuffer = Buffer.alloc(5);
    const lenLen = writeVarInt(lenBuffer, packetLength, 0);

    return Buffer.concat([
        lenBuffer.subarray(0, lenLen),
        idBuffer.subarray(0, idLen),
        dataBuffer
    ]);
}

function broadcast(packetBuffer, players) {
    for (const player of players.values()) {
        if (player.ws.readyState === 1) { // WebSocket.OPEN
            player.ws.send(packetBuffer);
        }
    }
}

module.exports = {
    readVarInt,
    writeVarInt,
    readString,
    writeString,
    makePacket,
    broadcast
};