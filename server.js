const WebSocket = require('ws');
const { initWorld, saveWorld, getWorldChanges, generateFlatChunkColumn, loadCurrentWorld, getWorldTime, tickWorldTime, setBlockInventory, getAllBlockInventoriesState, getBlockInventories } = require('./world');
const { tickAllFurnaces, broadcastFurnaceChanges } = require('./server/Furnace');
const { sendLoginSuccess, sendJoinGame, sendSpawnPosition, sendChunks, sendTimeUpdate } = require('./packets');
const { handlePacket, cleanupPlayerChunks } = require('./handlers');
const { addPlayer, removePlayer, getPlayerCount, getPlayers, savePlayerData, normalizeInventoryState } = require('./players');
const Logger = require('./logger');
const { BlockRegistry } = require('./src/js/net/minecraft/client/world/block/BlockRegistry.js');
const ServerWorld = require('./server/World.js');
const config = require('./config');

let log = Logger;
const PORT = config.port;

// Load the last used world, or default to 'main'
const currentWorld = loadCurrentWorld();
initWorld(currentWorld);
BlockRegistry.create(); // Initialize block registry from game code
const serverWorld = new ServerWorld(); // Initialize server world for block ticking

// Start server tick loop for block ticking and world time synchronization
setInterval(() => {
    serverWorld.onTick();
    tickWorldTime();

    const furnaces = tickAllFurnaces(getBlockInventories());
    broadcastFurnaceChanges(getPlayers(), furnaces);

    const worldTime = getWorldTime();
    const players = getPlayers();
    for (const player of players.values()) {
        if (player.ws.readyState === 1) {
            sendTimeUpdate(player, worldTime);
        }
    }
}, 1000 / 20); // Tick every 1/20th second

// Save world time and world state every 60 seconds.
setInterval(() => {
    saveWorld();
    //log.debug('World', 'Autosaved world time and state');
}, 60 * 1000);

// Periodically save player positions (every 30 seconds) for crash resilience
setInterval(() => {
    const players = getPlayers();
    for (const player of players.values()) {
        if (player.username) {
            savePlayerData(player);
        }
    }
}, 30 * 1000);

const fs = require('fs');
const https = require('https');

// Load SSL certificate and key if available
let server = null;
let options = {};

try {
    if (fs.existsSync('cert.pem') && fs.existsSync('key.pem')) {
        options = {
            cert: fs.readFileSync('cert.pem'),
            key: fs.readFileSync('key.pem')
        };
        server = https.createServer(options);
        log.info('Server', 'WSS enabled using cert.pem and key.pem');
    }
} catch (e) {
    log.error('Server', 'Failed to load SSL certificates: ' + e.message);
}

const wss = new WebSocket.Server({ server: server, port: !server ? PORT : undefined, host: config.host });
if (server) {
    server.listen(PORT, config.host);
}
log.info('Server', `Minecraft server running!!! (v47)`);
log.info('Server', `Listening on ${server ? 'wss' : 'ws'}://${config.host}:${PORT}`);

wss.on('connection', (ws) => {
    const player = {
        ws,
        eid: null,
        username: null,
        protocolState: 'handshake', // Start in handshake state
        x: 0.0,
        y: 64.0,
        z: 0.0,
        yaw: 0.0,
        pitch: 0.0,
        onGround: true,
        isSneaking: false
    };

    ws.on('message', (message, isBinary) => {
        if (isBinary) {
            handlePacket(player, message);
            return;
        }

        const text = message.toString('utf8');
        if (text === 'ping' || text === 'status') {
            const payload = {
                type: 'status',
                players: getPlayerCount(),
                maxPlayers: 20
            };
            ws.send(JSON.stringify(payload));
            return;
        }

        try {
            const payload = JSON.parse(text);
            if (payload && payload.type === 'inventory') {
                player.inventory = normalizeInventoryState(payload.inventory);
                savePlayerData(player);
            } else if (payload && payload.type === 'blockInventory') {
                const blockKey = payload.key || `chest:${payload.position?.x}:${payload.position?.y}:${payload.position?.z}`;
                if (blockKey && payload.inventory) {
                    setBlockInventory(blockKey, payload.inventory);
                    saveWorld();
                }
            } else if (payload && payload.type === 'death' && player) {
                const deathMsg = `${payload.username} ${payload.message}`;
                const { sendChatMessage } = require('./packets');
                sendChatMessage(deathMsg);
            } else if (payload && payload.type === 'attack' && player) {
                const targetId = payload.target;
                const damage = payload.damage || 2;
                const attacker = player.username;
                if (targetId != null) {
                    const players = getPlayers();
                    const hurtPacket = JSON.stringify({ type: 'hurt', eid: targetId, damage, attacker });
                    for (const [eid, p] of players) {
                        if (eid !== player.eid && p.ws.readyState === 1) {
                            p.ws.send(hurtPacket);
                        }
                    }
                }
            }
        } catch (err) {
            // Ignore non-JSON text messages.
        }
    });

    ws.on('close', () => {
        if (player.eid !== null) {
            removePlayer(player);
            cleanupPlayerChunks(player.eid);
        }
    });
});