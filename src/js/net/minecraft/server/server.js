const WebSocket = require('ws');
const { initWorld, saveWorld, getWorldChanges, generateFlatChunkColumn, loadCurrentWorld, getWorldTime, tickWorldTime, setBlockInventory, getAllBlockInventoriesState, getBlockInventories } = require('./world.js');
const { tickAllFurnaces, broadcastFurnaceChanges } = require('./Furnace.js');
const { sendLoginSuccess, sendJoinGame, sendSpawnPosition, sendChunks, sendTimeUpdate } = require('./packets.js');
const { handlePacket, cleanupPlayerChunks, respawnPlayer } = require('./handlers.js');
const { addPlayer, removePlayer, getPlayerCount, getPlayers, savePlayerData, normalizeInventoryState } = require('./players.js');
const Logger = require('./logger.js');
const { BlockRegistry } = require('../client/world/block/BlockRegistry.js');
const getServerWorld = require('./World.js');
const config = require('./config.js');

let log = Logger;
const PORT = config.port;

// Pick the server to run: a --server <name> CLI flag wins, otherwise resume
// the last used server (current_world.txt). The selected server's own
// serverconfig.conf (worlds/<name>/serverconfig.conf) is loaded before the
// listener binds, so its port/host apply when started that way.
const currentWorld = config.requestedServer || loadCurrentWorld();
config.reload(currentWorld);
initWorld(currentWorld);
BlockRegistry.create(); // Initialize block registry from game code
const serverWorld = getServerWorld(); // Initialize server world for block ticking

// Seed block ticks for any saved bluestone components so loaded networks
// (dust, lamps, repeaters, doors) settle to their correct state.
serverWorld.seedScheduledTicks(getWorldChanges());

// Start server tick loop for block ticking and world time synchronization
setInterval(() => {
    try {
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
    } catch (e) {
        // A single bad tick must never take down the whole server.
        log.error('Server', 'Error during server tick: ' + e.message);
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

const { IsomorphicFilesystem } = require('../client/fs/IsomorphicFilesystem.js');
const fs = new IsomorphicFilesystem();
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
        try {
            if (isBinary) {
                handlePacket(player, message);
                return;
            }

            const text = message.toString('utf8');
            if (text === 'ping' || text === 'status') {
                const payload = {
                    type: 'status',
                    players: getPlayerCount(),
                    maxPlayers: 35,
                    motd: config.motd || ''
                };
                ws.send(JSON.stringify(payload));
                return;
            }

            const payload = JSON.parse(text);
            if (payload && payload.type === 'inventory') {
                player.inventory = normalizeInventoryState(payload.inventory);
                savePlayerData(player);
            } else if (payload && payload.type === 'health') {
                if (typeof payload.health === 'number') {
                    player.health = Math.max(0, Math.min(20, payload.health));
                    savePlayerData(player);
                }
            } else if (payload && payload.type === 'gamemode') {
                if (typeof payload.gamemode === 'number') {
                    player.gamemode = payload.gamemode;
                    if (typeof payload.flying === 'boolean') {
                        player.isFlying = payload.flying;
                    }
                    savePlayerData(player);
                    const packets = require('./packets.js');
                    const protocol = require('./protocol.js');
                    protocol.broadcast(packets.sendPlayerListEntry([player], 1), getPlayers());
                }
            } else if (payload && payload.type === 'blockInventory') {
                const blockKey = payload.key || `chest:${payload.position?.x}:${payload.position?.y}:${payload.position?.z}`;
                if (blockKey && payload.inventory) {
                    setBlockInventory(blockKey, payload.inventory);
                    saveWorld();
                }
            } else if (payload && payload.type === 'death' && player) {
                const deathMsg = `${payload.username} ${payload.message}`;
                const { sendChatMessage } = require('./packets.js');
                sendChatMessage(deathMsg);
                player.health = 0;
                savePlayerData(player);
            } else if (payload && payload.type === 'respawn' && player) {
                respawnPlayer(player);
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
            // Malformed packets and non-JSON text messages are handled here so
            // a single bad connection can never crash the whole server.
            log.warn('Server', 'Rejected bad message from client: ' + (err && err.message));
        }
    });

    // Abrupt disconnects emit 'error' on the socket; without a listener that
    // unhandled 'error' event would crash the entire server process.
    ws.on('error', () => {
        // The 'close' handler does the actual cleanup.
    });

    ws.on('close', () => {
        if (player.eid !== null) {
            removePlayer(player);
            cleanupPlayerChunks(player.eid);
        }
    });
});