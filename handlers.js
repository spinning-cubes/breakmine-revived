const { readVarInt, readString, broadcast } = require('./protocol');
const { addPlayer, getPlayers, updatePosition, loadPlayerData, findPlayerByUsername, normalizeInventoryState } = require('./players');
const { addWorldChange, saveWorld, getBlockAt, getAllBlockInventoriesState } = require('./world');
const { addItemEntity, removeItemEntity, getItemEntity } = require('./entities');
const { handleCommand } = require('./commands');
const {
    sendLoginSuccess,
    sendJoinGame,
    sendSpawnPosition,
    sendChunks,
    sendSingleChunk,
    sendTimeUpdate,
    sendChatMessage,
    createSpawnPlayerPacket,
    createEntityTeleportPacket,
    createDestroyEntityPacket,
    createSpawnObjectPacket,
    sendPlayerListEntry,
    sendPlayerListData,
    createDisconnectPacket
} = require('./packets');
const { isSpectator } = require('./players');
const config = require('./config');
const Logger = require('./logger');

const badWordsModule = require('bad-words');
const Filter = badWordsModule.Filter || badWordsModule;
const filter = new Filter();

let log = Logger;

function canSee(viewer, target) {
    if (isSpectator(target)) {
        return isSpectator(viewer);
    }
    return true;
}

// Track which chunks each player has received
const playerChunks = new Map();

// Helper function to unpack Protocol 47 (1.8) packed 64-bit Position types
function readPosition(buffer, offset) {
    const val = buffer.readBigInt64BE(offset);

    // Protocol 47 Bit Allocations: X (26 MSBs), Z (26 LSBs), Y (12 bits in between)
    // We use BigInt bitwise arithmetic and shift them back to signed values
    let x = val >> 38n;
    let y = (val >> 26n) & 0xFFFn;
    let z = val & 0x3FFFFFFn;

    // Handle 2's complement sign extension for negative coordinates (using BigInt)
    const xBit = 1n << 25n;
    const yBit = 1n << 11n;
    const zBit = 1n << 25n;

    if (x >= xBit) x = x - (1n << 26n);
    if (y >= yBit) y = y - (1n << 12n);
    if (z >= zBit) z = z - (1n << 26n);

    return [Number(x), Number(y), Number(z)];
}

function handlePacket(player, buffer) {
    let offset = 0;
    const [length, lenBytes] = readVarInt(buffer, offset);
    offset += lenBytes;
    const [packetId, idBytes] = readVarInt(buffer, offset);
    offset += idBytes;

    if (player.protocolState === 'handshake') {
        handleHandshakePacket(player, packetId, buffer, offset);
        return;
    }

    if (player.protocolState === 'login') {
        handleLoginPacket(player, packetId, buffer, offset);
        return;
    }

    handlePlayPacket(player, packetId, buffer, offset);
}

function handleHandshakePacket(player, packetId, buffer, offset) {
    let ver, verBytes, addr, addrBytes, port, state, stateBytes;
    [ver, verBytes] = readVarInt(buffer, offset);
    offset += verBytes;
    [addr, addrBytes] = readString(buffer, offset);
    offset += addrBytes;
    port = buffer.readUInt16BE(offset);
    offset += 2;
    [state, stateBytes] = readVarInt(buffer, offset);
    offset += stateBytes;

    player.protocolState = state === 2 ? 'login' : 'status';

    if (state === 2 && buffer.length - offset > 0) {
        let count, countBytes;
        [count, countBytes] = readVarInt(buffer, offset);
        offset += countBytes;
        const mods = [];
        for (let i = 0; i < count; i++) {
            let modId, modName, modVersion, bytes;
            [modId, bytes] = readString(buffer, offset);
            offset += bytes;
            [modName, bytes] = readString(buffer, offset);
            offset += bytes;
            [modVersion, bytes] = readString(buffer, offset);
            offset += bytes;
            mods.push({ id: modId, name: modName, version: modVersion });
        }
        player.mods = mods;

        if (mods.length > 0) {
            log.info('Server', `${player.username || 'Unknown'} has mods: ${mods.map(m => `${m.name} v${m.version}`).join(', ')}`);
        }
    }
}

function handleLoginPacket(player, packetId, buffer, offset) {
    if (packetId === 0x00) {
        const [username, bytesConsumed] = readString(buffer, offset);

        player.username = username;

        if (!config.allowMods && player.mods && player.mods.length > 0) {
            const modNames = player.mods.map(m => m.name).join(', ');
            log.info('Server', `${username} kicked — mods not allowed (has: ${modNames})`);
            if (player.ws.readyState === 1) {
                player.ws.send(createDisconnectPacket(`§cThis server does not allow mods. Please disable your mods to join.`));
                player.ws.close();
            }
            return;
        }

        const existingPlayer = findPlayerByUsername(username);
        if (existingPlayer && false) {
            const reason = `§cA player with the name \"${username}\" is already online.`;
            if (player.ws.readyState === 1) {
                player.ws.send(createDisconnectPacket(reason));
                player.ws.close();
            }
            return;
        }

        player.protocolState = 'play';

        // Load player data if exists
        const playerData = loadPlayerData(username);
        if (playerData) {
            player.x = playerData.x || 0;
            player.y = playerData.y || 10;
            player.z = playerData.z || 0;
            player.yaw = playerData.yaw || 0;
            player.pitch = playerData.pitch || 0;
            player.isFlying = playerData.isFlying || false;
            player.health = typeof playerData.health === 'number' ? playerData.health : 20;
            player.inventory = normalizeInventoryState(playerData.inventory);
        } else {
            // Initialize player position at spawn
            player.x = 0;
            player.y = 10;
            player.z = 0;
            player.yaw = 0;
            player.pitch = 0;
            player.isFlying = false;
            player.inventory = normalizeInventoryState([]);
        }

        addPlayer(player);
        log.info('Chat', `${player.username} joined the game.`);

        sendLoginSuccess(player);
        sendJoinGame(player);
        sendSpawnPosition(player);

        // Initialize chunk tracking BEFORE sending chunks so checkAndSendChunks
        // can track which chunks have already been sent
        const sentChunks = new Set();
        // Pre-populate with the 5x5 spawn chunks that sendChunks will send
        for (let cx = -2; cx <= 2; cx++) {
            for (let cz = -2; cz <= 2; cz++) {
                sentChunks.add(`${cx},${cz}`);
            }
        }
        playerChunks.set(player.eid, sentChunks);

        // Send initial 5x5 spawn chunks + PlayerPositionLook
        sendChunks(player);

        // Immediately send the rest of the render distance worth of chunks
        // without waiting for the client's position response round-trip.
        // This prevents the loading screen from getting stuck at low progress
        // on slow connections.
        checkAndSendChunks(player);

        if (player.ws.readyState === 1) {
            player.ws.send(JSON.stringify({
                type: 'blockInventories',
                inventories: getAllBlockInventoriesState()
            }));

            // Send sign text updates for all signs
            const { getBlockInventories } = require('./world');
            const { sendSignTextUpdate } = require('./packets');
            const inventories = getBlockInventories();
            for (const [key, inv] of inventories) {
                if (inv && inv.text) {
                    const [x, y, z] = key.split(',').map(Number);
                    sendSignTextUpdate(player.ws, x, y, z, inv.text);
                }
            }
        }

        // Send initial time to client
        const { getWorldTime } = require('./world');
        sendTimeUpdate(player, getWorldTime());

        // Send player list to the new player (include self so Tab list shows own username)
        const players = getPlayers();
        const visiblePlayers = Array.from(players.values()).filter(p => p.eid === player.eid || canSee(player, p));
        player.ws.send(sendPlayerListEntry(visiblePlayers, 0));
        player.ws.send(sendPlayerListData());

        for (const [eid, p] of players) {
            if (eid === player.eid) continue;
            // Only send spawn for players visible to the new player
            if (canSee(player, p)) {
                player.ws.send(createSpawnPlayerPacket(p));
            }
            // Only send new player spawn to players who can see him
            if (canSee(p, player)) {
                p.ws.send(createSpawnPlayerPacket(player));
            }
            // Only send player list entry to players who can see the new player
            if (canSee(p, player)) {
                p.ws.send(sendPlayerListEntry([player], 0));
            }
        }

        // Send existing item entities to the new player
        const { getAllItemEntities } = require('./entities');
        const allItems = getAllItemEntities();
        for (const item of allItems) {
            player.ws.send(createSpawnObjectPacket(item));
        }

        sendChatMessage(`§e${player.username} joined the game.`);
    } else {
        log.error('Server', `Unknown login packet ID: 0x${packetId.toString(16)}`);
    }
}

function handlePlayPacket(player, packetId, buffer, offset) {
    switch (packetId) {
        case 0x01: { // Chat Message
            const [msg] = readString(buffer, offset);

            // Check if message is a command
            if (msg.startsWith('/')) {
                handleCommand(player, msg);
                log.info('Chat', `<${player.username}> executed command: ${msg}`);
            } else {
                log.info('Chat', `<${player.username}>: ${msg}`);
                let newname = player.username;
                if (player.username === "AlexMinecrafter") newname = '§d' + player.username + '§7';
                if (player.username === "developer") newname = '§4' + player.username + '§7';
                if (player.username === "kai") newname = '§b' + player.username + '§7';
                if (player.username === "LowQualityCoding") newname = '§a</>§f ' + player.username + '§7';
                if (player.username === "Marw-Programmer") newname = '§a' + player.username + '§7';
                if (player.username === "Hoofries") newname = '§1' + player.username + '§7';
                sendChatMessage(`§7<§f${newname}§7> §f${msg}`);
            }
            break;
        }

        case 0x04: { // Player Position
            player.x = buffer.readDoubleBE(offset);
            player.y = buffer.readDoubleBE(offset + 8);
            player.z = buffer.readDoubleBE(offset + 16);
            player.onGround = buffer.readUInt8(offset + 24) === 1;
            broadcastMovement(player);
            checkAndSendChunks(player);
            break;
        }

        case 0x05: { // Player Look
            player.yaw = buffer.readFloatBE(offset);
            player.pitch = buffer.readFloatBE(offset + 4);
            player.onGround = buffer.readUInt8(offset + 8) === 1;
            broadcastMovement(player);
            break;
        }

        case 0x06: { // Player Position And Look
            player.x = buffer.readDoubleBE(offset);
            player.y = buffer.readDoubleBE(offset + 8);
            player.z = buffer.readDoubleBE(offset + 16);
            player.yaw = buffer.readFloatBE(offset + 24);
            player.pitch = buffer.readFloatBE(offset + 28);
            player.onGround = buffer.readUInt8(offset + 32) === 1;
            broadcastMovement(player);
            checkAndSendChunks(player);
            break;
        }

        case 0x07: { // Protocol 47: Player Digging (Block Breaking)
            handlePlayerDigging(player, buffer, offset);
            break;
        }

        case 0x08: { // Protocol 47: Player Block Placement
            handleBlockPlacement(player, buffer, offset);
            break;
        }

        case 0x0A: { // Animation (Arm Swing)
            broadcastAnimation(player);
            break;
        }

        case 0x0B: { // Entity Action (Player State)
            const [entityId, eidBytes] = readVarInt(buffer, offset);
            const state = buffer.readUInt8(offset + eidBytes);
            const [jumpBoost, boostBytes] = readVarInt(buffer, offset + eidBytes + 1);

            if (entityId === player.eid) {
                if (state === 0) { 
                    player.isSneaking = true;
                    broadcastEntityMetadata(player);
                } else if (state === 1) { 
                    player.isSneaking = false;
                    broadcastEntityMetadata(player);
                }
            }
            break;
        }

        case 0x09: { // Client Drop Item
            handleDropItem(player, buffer, offset);
            break;
        }

        case 0x0D: { // Client Pickup Item
            handlePickupItem(player, buffer, offset);
            break;
        }

        case 0x0E: { // Client Update Sign Text
            handleUpdateSignText(player, buffer, offset);
            break;
        }


    }
}


function handlePlayerDigging(player, buffer, offset) {
    const status = buffer.readUInt8(offset); // 0: Started, 1: Cancelled, 2: Finished
    const [x, y, z] = readPosition(buffer, offset + 1);
    const face = buffer.readUInt8(offset + 9);

    // Status 2 is sent when survival blocks break or creative blocks are hit once
    if (status === 2 || status === 0) {
        const blockId = 0; // Air (broken block)

        addWorldChange(x, y, z, blockId);

        // Delete sign text / block inventory state on server
        const { deleteBlockInventory } = require('./world');
        deleteBlockInventory(`${x},${y},${z}`);

        saveWorld();

        const { sendBlockChange } = require('./packets');
        const players = getPlayers();
        const blockState = (blockId << 4) | 0; // No metadata for broken blocks
        for (const p of players.values()) {
            sendBlockChange(p.ws, x, y, z, blockState);
        }

        // Broadcast animation to other players when block is broken
        broadcastAnimation(player);
    }
}

function handleUpdateSignText(player, buffer, offset) {
    const [x, y, z] = readPosition(buffer, offset);
    const [rawText, textBytes] = readString(buffer, offset + 8);

    // Clean text using the bad-words library
    const text = filter.clean(rawText);

    log.info('Server', `Sign text update: ${x},${y},${z} = "${text}"`);

    const blockKey = `${x},${y},${z}`;
    const { setBlockInventory, saveWorld } = require('./world');
    
    setBlockInventory(blockKey, { text: text });
    saveWorld();

    // Broadcast sign text update to all players via packet
    const { sendSignTextUpdate } = require('./packets');
    const players = getPlayers();
    for (const p of players.values()) {
        if (p.ws.readyState === 1) {
            sendSignTextUpdate(p.ws, x, y, z, text);
        }
    }
}

function handleBlockPlacement(player, buffer, offset) {
    const [x, y, z] = readPosition(buffer, offset);
    const direction = buffer.readUInt8(offset + 8);

    // Read held item from packet (offset + 9)
    const heldItemId = buffer.readInt16BE(offset + 9);

    if (direction !== 255) {
        // Calculate offset block position based on face targeted
        const dx = [0, 0, 0, 0, -1, 1][direction];
        const dy = [-1, 1, 0, 0, 0, 0][direction];
        const dz = [0, 0, -1, 1, 0, 0][direction];

        const placeX = x + dx;
        const placeY = y + dy;
        const placeZ = z + dz;

        // Prevent placement below y=0
        if (placeY < 0) {
            return;
        }

        // Prevent placement inside other players
        const players = getPlayers();
        for (const p of players.values()) {
            // Player bounding box: width 0.6, height 1.8
            const playerMinX = p.x - 0.3;
            const playerMaxX = p.x + 0.3;
            const playerMinY = p.y;
            const playerMaxY = p.y + 1.8;
            const playerMinZ = p.z - 0.3;
            const playerMaxZ = p.z + 0.3;

            // Check if block intersects with player (AABB intersection)
            if (placeX < playerMaxX && placeX + 1 > playerMinX &&
                placeY < playerMaxY && placeY + 1 > playerMinY &&
                placeZ < playerMaxZ && placeZ + 1 > playerMinZ) {
                // Send block change to revert client prediction
                const { sendBlockChange } = require('./packets');
                const { getBlockAt, getBlockMetadata } = require('./world');
                const currentBlockId = getBlockAt(placeX, placeY, placeZ) || 0;
                const currentMetadata = getBlockMetadata(placeX, placeY, placeZ) || 0;
                const currentBlockState = (currentBlockId << 4) | currentMetadata;
                sendBlockChange(player.ws, placeX, placeY, placeZ, currentBlockState);
                return;
            }
        }

        // Use held item ID
        let blockId = heldItemId > 0 ? heldItemId : 1;

        // Custom Stair Block IDs registered in BlockRegistry:
        // 150: Oak, 151: Spruce, 152: Birch, 153: Jungle, 154: Acacia,
        // 155: Cobblestone, 156: Mossy Cobblestone, 157: Brick
        const isStair = [150, 151, 152, 153, 154, 155, 156, 157].includes(blockId);

        // Calculate metadata based on block type and placement direction
        let metadata = 0;

        if (blockId === 50) { // Torch
            if (direction === 1) metadata = 5;
            else if (direction === 2) metadata = 4;
            else if (direction === 3) metadata = 3;
            else if (direction === 4) metadata = 2;
            else if (direction === 5) metadata = 1;
            else metadata = 5;
        } else if (blockId === 17 || blockId === 59 || blockId === 62 || blockId === 65 || blockId === 68) { // Logs
            if (direction === 4 || direction === 5) metadata = 1;
            else if (direction === 2 || direction === 3) metadata = 2;
            else metadata = 0;
        } else if (blockId >= 70 && blockId <= 77) { // Slabs
            if (direction === 0) metadata = 1;
            else metadata = 0;
        } else if (blockId === 32 || blockId === 34) { // Chest and Furnace
            let yaw = player.yaw ?? player.rotationYaw ?? 0;
            let dirIndex = Math.floor((yaw * 4 / 360) + 0.5) & 3;
            metadata = [2, 5, 3, 4][dirIndex];
        } else if (isStair) { // Custom Stair Rotation
            let yaw = player.yaw ?? player.rotationYaw ?? 0;
            let dirIndex = Math.floor((yaw * 4 / 360) + 0.5) & 3;
            // Inverted array mapping (3: NORTH, 0: EAST, 2: SOUTH, 1: WEST) to match client placement
            metadata = [3, 0, 2, 1][dirIndex];
            // Upside-down stair if placed against bottom face of overhead block
            if (direction === 0) metadata |= 4;
        } else if (blockId === 121) { // BlockRegistry.SIGN
            let yaw = player.yaw ?? player.rotationYaw ?? 0;
            let dirIndex = Math.floor((yaw * 4 / 360) + 0.5) & 3;
            // 0: South, 2: North -> X-axis rotation (data = 1); 1: West, 3: East -> Z-axis rotation (data = 0)
            if (dirIndex === 0 || dirIndex === 2) {
                metadata = 1;
            } else {
                metadata = 0;
            }
        }

        addWorldChange(placeX, placeY, placeZ, blockId, metadata);
        saveWorld();

        const { sendBlockChange } = require('./packets');
        const blockState = (blockId << 4) | metadata;
        for (const p of players.values()) {
            sendBlockChange(p.ws, placeX, placeY, placeZ, blockState);
        }

        // Broadcast animation to other players when block is placed
        broadcastAnimation(player);
    }
}

function broadcastMovement(player) {
    const packet = createEntityTeleportPacket(player);
    const players = getPlayers();
    for (const [eid, p] of players) {
        if (eid === player.eid) continue;
        if (!canSee(p, player)) continue;
        p.ws.send(packet);
    }
}

function broadcastEntityMetadata(player) {
    const { createEntityMetadataPacket } = require('./packets');
    const packet = createEntityMetadataPacket(player);
    const players = getPlayers();
    for (const [eid, p] of players) {
        if (eid === player.eid) continue;
        if (!canSee(p, player)) continue;
        p.ws.send(packet);
    }
}

function broadcastAnimation(player) {
    const { createAnimationPacket } = require('./packets');
    const packet = createAnimationPacket(player);
    const players = getPlayers();
    for (const [eid, p] of players) {
        if (eid === player.eid) continue;
        if (!canSee(p, player)) continue;
        p.ws.send(packet);
    }
}

function handleDropItem(player, buffer, offset) {
    const blockId = buffer.readInt16BE(offset);

    // Calculate spawn position slightly in front of player
    const yaw = ((player.yaw % 360) + 360) % 360;
    const rad = yaw * Math.PI / 180;
    const spawnX = player.x - Math.sin(rad) * 0.5;
    const spawnY = player.y + 1.0;
    const spawnZ = player.z + Math.cos(rad) * 0.5;

    // Motion: throw forward and up
    const motionX = -Math.sin(rad) * 0.15;
    const motionY = 0.2;
    const motionZ = Math.cos(rad) * 0.15;

    const entity = addItemEntity(blockId, spawnX, spawnY, spawnZ, motionX, motionY, motionZ, player.eid);

    // Broadcast spawn to all players
    const packet = createSpawnObjectPacket(entity);
    const players = getPlayers();
    for (const p of players.values()) {
        if (p.ws.readyState === 1) {
            p.ws.send(packet);
        }
    }
}

function handlePickupItem(player, buffer, offset) {
    const [entityId, eidBytes] = readVarInt(buffer, offset);

    const entity = getItemEntity(entityId);
    if (!entity) return;

    // Remove from server tracking
    removeItemEntity(entityId);

    // Broadcast destroy to all players
    const destroyPacket = createDestroyEntityPacket(entityId);
    const players = getPlayers();
    for (const p of players.values()) {
        if (p.ws.readyState === 1) {
            p.ws.send(destroyPacket);
        }
    }
}

function checkAndSendChunks(player) {
    const renderDistance = 5;
    const playerChunkX = Math.floor(player.x / 16);
    const playerChunkZ = Math.floor(player.z / 16);

    const sentChunks = playerChunks.get(player.eid) || new Set();
    const { getWorldChanges } = require('./world');
    const worldChanges = getWorldChanges();

    for (let cx = playerChunkX - renderDistance; cx <= playerChunkX + renderDistance; cx++) {
        for (let cz = playerChunkZ - renderDistance; cz <= playerChunkZ + renderDistance; cz++) {
            const chunkKey = `${cx},${cz}`;
            if (!sentChunks.has(chunkKey)) {
                sendSingleChunk(player, cx, cz, worldChanges);
                sentChunks.add(chunkKey);
            }
        }
    }

    playerChunks.set(player.eid, sentChunks);
}

function cleanupPlayerChunks(eid) {
    playerChunks.delete(eid);
}

module.exports = {
    handlePacket,
    cleanupPlayerChunks
};