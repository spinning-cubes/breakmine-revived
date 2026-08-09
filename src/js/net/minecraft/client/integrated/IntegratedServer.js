import { Buffer } from 'buffer';
import { globalLoopbackServer } from '../../util/IsomorphicWebSocket.js';
import fs from '../fs/ServerFs.js';
import { initServer, onConnection, stopServer } from '../../server/ServerRuntime.js';
import * as serverWorld from '../../server/world.js';
import * as serverPlayers from '../../server/players.js';
import * as serverEntities from '../../server/entities.js';
import config from '../../server/config.js';
import path from '../../util/path.js';
import Long from '../../../../../../libraries/long.js';

// worldKey is always 'w_<timestamp>_<random>'

const MODULE_DIR = new URL('.', import.meta.url).pathname;
const PROJECT_ROOT = path.join(MODULE_DIR, '..', '..', '..', '..', '..');
const WORLDS_DIR = path.join(PROJECT_ROOT, 'worlds');

export const integrated = {
    running: false,
    serverName: null,
};

export function serverNameForKey(worldKey) {
    return String(worldKey || 'main').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'main';
}

// Parse the simple `key=value` serverconfig.conf format (mirrors the fields
// the server's own config loader understands, plus `name` metadata).
function parseServerConfig(content) {
    const conf = {};
    for (const line of String(content || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        conf[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return conf;
}

function gamemodeName(value) {
    const gm = String(value == null ? '' : value).toLowerCase();
    if (gm === '0' || gm === 'survival') return 'survival';
    if (gm === '1' || gm === 'creative') return 'creative';
    if (gm === '3' || gm === 'spectator') return 'spectator';
    return 'creative';
}

export async function listServerWorlds() {
    await fs.ready();

    if (!fs.existsSync(WORLDS_DIR)) {
        return [];
    }

    const worlds = [];
    for (const entry of fs.readdirSync(WORLDS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === 'main' || !/^[a-z0-9_]+$/.test(entry.name)) continue;

        const dir = path.join(WORLDS_DIR, entry.name);
        const confPath = path.join(dir, 'serverconfig.conf');
        const dataPath = path.join(dir, 'world_data.bin');
        if (!fs.existsSync(confPath) && !fs.existsSync(dataPath)) continue;

        const conf = fs.existsSync(confPath) ? parseServerConfig(fs.readFileSync(confPath, 'utf8')) : {};

        let seedLow = 0;
        let seedHigh = 0;
        if (conf.seed !== undefined && conf.seed !== null && conf.seed !== '') {
            try {
                const seedLong = Long.fromString(String(conf.seed));
                seedLow = seedLong.low;
                seedHigh = seedLong.high;
            } catch (e) {
                // Unparseable seed; leave as zero.
            }
        }

        let time = 0;
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath);
            if (data.length >= 8) {
                time = Number(data.readBigInt64BE(0));
            }
        }

        worlds.push({
            key: entry.name,
            name: conf.name || '',
            seedLow,
            seedHigh,
            worldType: conf.worldType || 'normal',
            gameMode: gamemodeName(conf.default_gamemode),
            time,
        });
    }
    return worlds;
}

function wsAdapter(serverSocket) {
    const listeners = {};

    serverSocket.addEventListener('message', (event) => {
        if (typeof listeners.message !== 'function') return;
        const data = event && event.data;
        if (typeof data === 'string') {
            listeners.message(data, false);
        } else {
            listeners.message(Buffer.from(new Uint8Array(data)), true);
        }
    });
    serverSocket.addEventListener('close', (event) => {
        if (typeof listeners.close === 'function') listeners.close(event);
    });
    serverSocket.addEventListener('error', (event) => {
        if (typeof listeners.error === 'function') listeners.error(event);
    });

    return {
        get readyState() {
            return serverSocket.readyState;
        },
        on: (event, callback) => {
            listeners[event] = callback;
        },
        off: (event, callback) => {
            if (listeners[event] === callback) delete listeners[event];
        },
        send: (data) => serverSocket.send(data),
        close: (code, reason) => serverSocket.close(code, reason),
    };
}

const connectionHandler = (serverSocket) => onConnection(wsAdapter(serverSocket));

export async function startIntegratedServer(options) {
    const serverName = serverNameForKey(options.worldKey);

    if (integrated.running && integrated.serverName === serverName) {
        return;
    }
    if (integrated.running) {
        stopIntegratedServer();
    }

    await fs.ready();

    const serverDir = serverWorld.getWorldDir(serverName);
    if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
    }

    const seedLong = new Long(options.seedLow || 0, options.seedHigh || 0);
    const confPath = path.join(serverDir, 'serverconfig.conf');
    const existingConf = fs.existsSync(confPath) ? parseServerConfig(fs.readFileSync(confPath, 'utf8')) : null;
    const worldName = options.name || (existingConf && existingConf.name) || '';
    const confLines = [
        '# Auto-generated by the integrated server (singleplayer)',
        `default_gamemode=${options.gameMode || 'creative'}`,
        `worldType=${options.worldType || 'normal'}`,
        `seed=${seedLong.toString()}`,
        'allowMods=true',
    ];
    if (worldName) {
        confLines.push(`name=${worldName}`);
    }
    confLines.push('');
    fs.writeFileSync(confPath, confLines.join('\n'));

    config.reload(serverName);
    serverWorld.initWorld(serverName);

    // One-time migration of a legacy IndexedDB save into the server's file
    // layout. Runs between initWorld() (clears maps, creates the dir) and
    // initServer() (re-reads world_data.bin from disk).
    if (options.migrateData) {
        migrateLegacySave(options.migrateData, options.username);
    }

    initServer();

    // Register before the client opens the loopback socket, otherwise the
    // connection is never seen by the server.
    globalLoopbackServer.onConnection(connectionHandler);

    integrated.running = true;
    integrated.serverName = serverName;
}

export function stopIntegratedServer() {
    if (!integrated.running) return;
    stopServer();
    globalLoopbackServer.offConnection(connectionHandler);
    integrated.running = false;
    integrated.serverName = null;
}

export function isIntegratedRunning() {
    return integrated.running;
}

export function getIntegratedServerName() {
    return integrated.serverName;
}

// Remove a world's server files (world_data.bin, serverconfig.conf,
// players/...). The browser fs has no rmSync, so walk and unlink instead.
export function deleteServerWorld(worldKey) {
    const serverName = serverNameForKey(worldKey);
    const dir = serverWorld.getWorldDir(serverName);
    const files = [];
    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) walk(p);
            else files.push(p);
        }
    };
    try {
        if (fs.existsSync(dir)) walk(dir);
    } catch (e) {
        // Directory not readable; nothing to delete.
    }
    for (const file of files) {
        try {
            fs.unlinkSync(file);
        } catch (e) {
            // Ignore individual file failures.
        }
    }
}

function migrateLegacySave(saveData, username) {
    const chunks = saveData.chunks || {};
    for (const key in chunks) {
        const chunkData = chunks[key];
        if (!chunkData || !Array.isArray(chunkData.sections)) continue;
        const cx = chunkData.x;
        const cz = chunkData.z;
        for (let sy = 0; sy < chunkData.sections.length; sy++) {
            const section = chunkData.sections[sy];
            if (!section || !section.blocks) continue;
            for (const idxStr in section.blocks) {
                const idx = parseInt(idxStr, 10);
                const blockId = section.blocks[idx];
                if (!blockId) continue;
                const metadata = (section.blocksData && section.blocksData[idxStr]) || 0;
                serverWorld.addWorldChange(
                    cx * 16 + (idx & 15),
                    sy * 16 + ((idx >> 8) & 15),
                    cz * 16 + ((idx >> 4) & 15),
                    blockId,
                    metadata
                );
            }
        }
    }

    // Block inventories (chests / furnaces / signs)
    if (Array.isArray(saveData.blockInventories)) {
        for (const entry of saveData.blockInventories) {
            if (!entry || !entry.key) continue;
            serverWorld.setBlockInventory(entry.key, entry.state || entry.inventory || null);
        }
    }

    // World time
    if (typeof saveData.time === 'number') {
        serverWorld.setWorldTime(saveData.time);
    }

    // Dropped items (in-memory; regenerated from player drops if lost)
    if (Array.isArray(saveData.itemEntities)) {
        for (const item of saveData.itemEntities) {
            serverEntities.addItemEntity(
                item.blockId || 0,
                item.x || 0,
                item.y || 0,
                item.z || 0,
                item.motionX || 0,
                item.motionY || 0,
                item.motionZ || 0,
                0
            );
        }
    }

    // Player state -> players/<username>.json so the login handler restores it
    const gm = saveData.playerGameMode || {};
    serverPlayers.savePlayerData({
        username: username || 'Player',
        x: saveData.playerPos ? saveData.playerPos.x : undefined,
        y: saveData.playerPos ? saveData.playerPos.y : undefined,
        z: saveData.playerPos ? saveData.playerPos.z : undefined,
        yaw: saveData.playerRot ? saveData.playerRot.yaw : 0,
        pitch: saveData.playerRot ? saveData.playerRot.pitch : 0,
        isFlying: !!gm.flying,
        gamemode: gm.spectator ? 3 : gm.creative ? 1 : 0,
        health: typeof saveData.playerHealth === 'number' ? saveData.playerHealth : 20,
        inventory: saveData.playerInventory || [],
    });

    serverWorld.saveWorld();
}
