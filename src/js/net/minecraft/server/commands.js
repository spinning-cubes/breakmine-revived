import { Buffer } from '../../../../../libraries/buffer.js';
import Logger from './logger.js';
import { sendChatMessage, sendPlayerPositionLook, createEntityTeleportPacket, sendPlayerListEntry, createSpawnPlayerPacket, createDestroyEntityPacket, sendTimeUpdate, sendRespawn, sendSpawnPosition, sendChunks, sendResetWorldPacket } from './packets.js';
import { broadcast, writeString, makePacket } from './protocol.js';
import { getPlayers, isSpectator, findPlayerByUsername, isOp, savePlayerData, loadPlayerData, normalizeInventoryState } from './players.js';
import config from './config.js';
import { initWorld, saveWorld, getCurrentWorldName, getSpawnPosition, getWorldTime, setWorldTime } from './world.js';
import { cleanupPlayerChunks } from './handlers.js';

function canSee(viewer, target) {
    if (isSpectator(target)) {
        return isSpectator(viewer);
    }
    return true;
}

const log = Logger;

function requireOp(player) {
    if (isOp(player)) {
        return true;
    }
    sendChatMessageToPlayer(player, '§cYou do not have permission to use this command.');
    return false;
}

function handleCommand(player, command) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case '/tp':
            if (requireOp(player)) handleTp(player, args);
            break;
        case '/gamemode':
            if (requireOp(player)) handleGamemode(player, args);
            break;
        case '/help':
            handleHelp(player);
            break;
        case '/time':
            handleTime(player, args);
            break;
        case '/heal':
            if (requireOp(player)) handleHeal(player, args);
            break;
        case '/world':
        case '/server':
            handleServer(player, args);
            break;
        default:
            sendChatMessageToPlayer(player, `§cUnknown command: ${cmd}`);
    }
}

function handleTp(player, args) {
    if (args.length < 3) {
        sendChatMessageToPlayer(player, '§cUsage: /tp <x> <y> <z>');
        return;
    }

    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    const z = parseFloat(args[2]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        sendChatMessageToPlayer(player, '§cInvalid coordinates');
        return;
    }

    player.x = x;
    player.y = y;
    player.z = z;

    // Send position update to player
    sendPlayerPositionLook(player);

    // Broadcast movement to other players who can see this player
    const packet = createEntityTeleportPacket(player);
    const players = getPlayers();
    for (const [eid, p] of players) {
        if (eid !== player.eid && canSee(p, player)) {
            p.ws.send(packet);
        }
    }

    sendChatMessageToPlayer(player, `§aTeleported to ${x}, ${y}, ${z}`);
}

function handleHeal(player, args) {
    if (args.length < 2) {
        sendChatMessageToPlayer(player, '§cUsage: /heal <player> <amount>');
        return;
    }

    const targetName = args[0];
    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
        sendChatMessageToPlayer(player, '§cInvalid amount');
        return;
    }

    let target = null;
    if (targetName === '@s' || targetName === player.username) {
        target = player;
    } else {
        target = findPlayerByUsername(targetName);
    }

    if (!target) {
        sendChatMessageToPlayer(player, `§cPlayer not found: ${targetName}`);
        return;
    }

    target.health = Math.min(20, (target.health || 20) + amount);
    target.ws.send(JSON.stringify({ type: 'health', health: target.health }));
    sendChatMessageToPlayer(player, `§aHealed ${target.username} by ${amount} HP`);
}

function handleHelp(player) {
    sendChatMessageToPlayer(player, '§6Available commands:');
    sendChatMessageToPlayer(player, '§e/tp <x> <y> <z> §7- Teleport to coordinates');
    sendChatMessageToPlayer(player, '§e/gamemode <survival|creative|spectator> §7- Change game mode');
    sendChatMessageToPlayer(player, '§e/time §7- Show current in-game time');
    sendChatMessageToPlayer(player, '§e/time set <number> §7- Set time to specific tick value');
    sendChatMessageToPlayer(player, '§e/time set <day|night|midnight|noon> §7- Set time to preset');
    sendChatMessageToPlayer(player, '§e/heal <player> <amount> §7- Heal a player');
    sendChatMessageToPlayer(player, '§e/server [name] §7- Show current server or switch servers');
    sendChatMessageToPlayer(player, '§e/server list §7- List all available servers');
    sendChatMessageToPlayer(player, '§e/help §7- Show this help message');
}

function handleGamemode(player, args) {
    if (args.length < 1) {
        sendChatMessageToPlayer(player, '§cUsage: /gamemode <survival|creative|spectator  0|1|3>');
        return;
    }

    const mode = args[0].toLowerCase();
    let gamemode;

    if (mode === 'survival' || mode === '0') {
        gamemode = 0;
    } else if (mode === 'creative' || mode === '1') {
        gamemode = 1;
    } else if (mode === 'spectator' || mode === '3') {
        gamemode = 3;
    } else {
        sendChatMessageToPlayer(player, '§cInvalid gamemode. Use: survival (0), creative (1), or spectator (3)');
        return;
    }

    // Track old gamemode before changing
    const oldGamemode = player.gamemode;
    player.gamemode = gamemode;

    // Send gamemode change to the client via JSON message
    player.ws.send(JSON.stringify({ type: 'gamemode', gamemode: gamemode }));

    // Update visibility for all other players
    const players = getPlayers();
    for (const [eid, p] of players) {
        if (p.ws.readyState !== 1) continue;

        const oldVisible = oldGamemode !== 3 || isSpectator(p);
        const newVisible = gamemode !== 3 || isSpectator(p);

        if (p.eid === player.eid) {
            p.ws.send(sendPlayerListEntry([player], 1));
        } else if (newVisible && !oldVisible) {
            p.ws.send(sendPlayerListEntry([player], 0));
            p.ws.send(createSpawnPlayerPacket(player));
        } else if (!newVisible && oldVisible) {
            p.ws.send(createDestroyEntityPacket(player.eid));
            p.ws.send(sendPlayerListEntry([player], 4));
        } else if (newVisible) {
            p.ws.send(sendPlayerListEntry([player], 1));
        }
    }

    const modeName = gamemode === 0 ? 'Survival' : gamemode === 1 ? 'Creative' : 'Spectator';
    sendChatMessageToPlayer(player, `Your game mode has been updated to ${modeName}`);
}

function handleTime(player, args) {
    const players = getPlayers();

    if (args.length === 0) {
        // Show current time
        const time = getWorldTime();
        const hours = Math.floor(time / 1000);
        const minutes = Math.floor((time % 1000) * 60 / 1000);
        const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
        sendChatMessageToPlayer(player, `§6Current time: ${timeStr} (${time} ticks)`);
        return;
    }

    if (args[0].toLowerCase() === 'set') {
        if (!requireOp(player)) {
            return;
        }
        if (args.length < 2) {
            sendChatMessageToPlayer(player, '§cUsage: /time set <number|day|night|midnight|noon>');
            return;
        }

        const value = args[1].toLowerCase();
        let newTime;

        // Handle preset times
        if (value === 'day') {
            newTime = 1000; // Morning
        } else if (value === 'night') {
            newTime = 13000; // Evening
        } else if (value === 'midnight') {
            newTime = 18000; // Midnight
        } else if (value === 'noon') {
            newTime = 6000; // Noon
        } else {
            // Handle numeric value
            newTime = parseInt(value);
            if (isNaN(newTime) || newTime < 0) {
                sendChatMessageToPlayer(player, '§cInvalid time value. Must be a positive number.');
                return;
            }
        }

        setWorldTime(newTime);

        // Send time update to all clients
        for (const p of players.values()) {
            sendTimeUpdate(p, newTime);
        }

        const hours = Math.floor(newTime / 1000);
        const minutes = Math.floor((newTime % 1000) * 60 / 1000);
        const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
        sendChatMessage(`§eTime set to ${timeStr} (${newTime} ticks)`);
    } else {
        sendChatMessageToPlayer(player, '§cUsage: /time [set <value>]');
    }
}

function handleServer(player, args) {
    if (args.length === 0) {
        sendChatMessageToPlayer(player, `§6Current server: §e${getCurrentWorldName()}`);
        return;
    }

    const subCommand = args[0].toLowerCase();

    if (subCommand === 'list') {
        const servers = config.listServers();
        sendChatMessageToPlayer(player, '§6Available servers:');
        servers.forEach(server => {
            const isCurrent = server === getCurrentWorldName() ? ' §7(current)' : '';
            sendChatMessageToPlayer(player, `§e- ${server}${isCurrent}`);
        });
        return;
    }

    const serverName = subCommand;

    if (!requireOp(player)) {
        return;
    }

    if (serverName === getCurrentWorldName()) {
        sendChatMessageToPlayer(player, `§cYou are already in server "${serverName}"`);
        return;
    }

    // Persist each player's state on the server they are leaving before
    // switching, so their position/inventory stay intact per server.
    const players = getPlayers();
    for (const p of players.values()) {
        if (p.username) {
            savePlayerData(p);
        }
    }

    // Save current server
    saveWorld();

    // Load the target server's own config (world type, seed, gamemode, ...).
    // If it has no serverconfig.conf the current settings are kept.
    config.reload(serverName);

    // Load new server
    initWorld(serverName);

    const spawn = getSpawnPosition();

    for (const p of players.values()) {
        // Apply the player's saved state for the new server, or fall back to
        // the spawn point if they have never been there.
        const playerData = loadPlayerData(p.username);
        if (playerData) {
            p.x = typeof playerData.x === 'number' ? playerData.x : spawn.x;
            p.y = typeof playerData.y === 'number' ? playerData.y : spawn.y;
            p.z = typeof playerData.z === 'number' ? playerData.z : spawn.z;
            p.yaw = typeof playerData.yaw === 'number' ? playerData.yaw : 0;
            p.pitch = typeof playerData.pitch === 'number' ? playerData.pitch : 0;
            p.isFlying = playerData.isFlying || false;
            p.gamemode = typeof playerData.gamemode === 'number' ? playerData.gamemode : p.gamemode;
            p.health = typeof playerData.health === 'number' && playerData.health > 0 ? playerData.health : 20;
            p.inventory = normalizeInventoryState(playerData.inventory);
        } else {
            p.x = spawn.x;
            p.y = spawn.y;
            p.z = spawn.z;
            p.yaw = 0;
            p.pitch = 0;
            p.isFlying = false;
            p.health = 20;
            p.inventory = normalizeInventoryState([]);
        }

        // Forget which chunks were already sent so every chunk around the
        // player's (possibly far away) saved position is streamed fresh.
        cleanupPlayerChunks(p.eid);

        // Send reset world packet to clear all chunks
        sendResetWorldPacket(p);

        // Send respawn packet (dimension 0 = overworld)
        sendRespawn(p, 0);

        // Authoritative restore so the client targets the saved position while
        // it streams in the new server's terrain.
        if (p.ws.readyState === 1) {
            p.ws.send(JSON.stringify({
                type: 'playerState',
                x: p.x,
                y: p.y,
                z: p.z,
                yaw: p.yaw,
                pitch: p.pitch,
                health: p.health,
                gamemode: p.gamemode,
                flying: !!p.isFlying
            }));
            p.ws.send(JSON.stringify({ type: 'inventory', inventory: p.inventory }));
            p.ws.send(JSON.stringify({ type: 'health', health: p.health }));
            p.ws.send(JSON.stringify({ type: 'gamemode', gamemode: p.gamemode, flying: !!p.isFlying }));
        }

        // Send chunks from the new server
        sendChunks(p);

        // Send spawn position
        sendSpawnPosition(p);

        // Send position update
        sendPlayerPositionLook(p);
    }

    sendChatMessage(`§eServer switched to "${serverName}"`);
}

function sendChatMessageToPlayer(player, message) {
    const chatJson = JSON.stringify({ text: message });
    const chatData = Buffer.alloc(Buffer.byteLength(chatJson) + 6);
    let offset = 0;
    offset += writeString(chatData, chatJson, offset);
    chatData.writeUInt8(0, offset);
    player.ws.send(makePacket(0x02, chatData.subarray(0, offset)));
}

export {
    handleCommand
};
