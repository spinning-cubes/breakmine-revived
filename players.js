const players = new Map();
let nextEntityId = 1;
const Logger = require('./logger');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let log = Logger;

const PLAYERS_DIR = path.join(__dirname, 'players');

// Ensure players directory exists
if (!fs.existsSync(PLAYERS_DIR)) {
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

function normalizeItem(item) {
    if (!item || typeof item !== 'object') {
        return { typeId: 0, count: 0 };
    }

    return {
        typeId: item.typeId ?? 0,
        count: item.count ?? 0
    };
}

function normalizeInventoryState(inventory) {
    if (Array.isArray(inventory)) {
        return {
            selectedSlotIndex: 0,
            itemInCursor: { typeId: 0, count: 0 },
            items: inventory.map(normalizeItem)
        };
    }

    if (!inventory || typeof inventory !== 'object') {
        return {
            selectedSlotIndex: 0,
            itemInCursor: { typeId: 0, count: 0 },
            items: []
        };
    }

    const items = Array.isArray(inventory.items) ? inventory.items.map(normalizeItem) : [];
    while (items.length < 36) {
        items.push({ typeId: 0, count: 0 });
    }

    return {
        selectedSlotIndex: Number(inventory.selectedSlotIndex || 0),
        itemInCursor: normalizeItem(inventory.itemInCursor),
        items
    };
}

const GAMEMODE_MAP = { survival: 0, creative: 1, spectator: 3 };

function addPlayer(player) {
    player.eid = nextEntityId++;
    player.joinTime = Date.now();
    player.gamemode = GAMEMODE_MAP[config.default_gamemode] ?? 1;
    player.inventory = normalizeInventoryState(player.inventory);
    players.set(player.eid, player);
}

function findPlayerByUsername(username) {
    if (!username) {
        return null;
    }

    const normalized = username.toLowerCase();
    for (const player of players.values()) {
        if (player && player.username && player.username.toLowerCase() === normalized) {
            return player;
        }
    }

    return null;
}

function removePlayer(player) {
    // Lazily require packets here. To bypass the circular dependency safely,
    // we ensure we access module.exports after the application has fully initialized.
    const packets = require('./packets');
    const protocol = require('./protocol');

    // Send player list removal (action 4 = REMOVE_PLAYER) BEFORE deleting from map
    if (packets.sendPlayerListEntry && protocol.broadcast) {
        const removePacket = packets.sendPlayerListEntry([player], 4);
        protocol.broadcast(removePacket, players);

        // Send destroy entity packet to remove player entity from all clients
        protocol.broadcast(packets.createDestroyEntityPacket(player.eid), players);
    }

    // Save player data before removing
    savePlayerData(player);

    // Remove from players map
    players.delete(player.eid);

    const playTime = Math.floor((Date.now() - player.joinTime) / 1000);
    log.info('Chat', `${player.username} left the game. (Play time: ${playTime}s)`);

    if (packets.sendChatMessage) {
        packets.sendChatMessage(`§e${player.username} left the game.`);
    }
}

function getPlayers() {
    return players;
}

function getPlayerCount() {
    return players.size;
}

function updatePosition(player) {
    // Placeholder for position validation if needed
}

function getPlayerFile(username) {
    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return path.join(PLAYERS_DIR, `${sanitized}.json`);
}

function savePlayerData(player) {
    const playerFile = getPlayerFile(player.username);
    const data = {
        username: player.username,
        x: player.x,
        y: player.y,
        z: player.z,
        yaw: player.yaw,
        pitch: player.pitch,
        isFlying: player.isFlying || false,
        inventory: normalizeInventoryState(player.inventory)
    };
    fs.writeFileSync(playerFile, JSON.stringify(data, null, 2));
}

function loadPlayerData(username) {
    const playerFile = getPlayerFile(username);
    if (fs.existsSync(playerFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(playerFile, 'utf8'));
            return data;
        } catch (e) {
            log.warn('Players', `Failed to load player data for ${username}: ${e.message}`);
            return null;
        }
    }
    return null;
}

module.exports = {
    addPlayer,
    findPlayerByUsername,
    removePlayer,
    getPlayers,
    getPlayerCount,
    updatePosition,
    savePlayerData,
    loadPlayerData,
    normalizeInventoryState
};