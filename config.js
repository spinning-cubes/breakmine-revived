const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'serverconfig.conf');

const defaults = {
    port: 6008,
    host: '0.0.0.0',
    default_gamemode: 'creative',
    default_op: 'true',
    op_player_list: [],
    motd: 'Brand new server',
    allowMods: false,
    worldType: 'flat',
    seed: 0
};

function parseValue(value) {
    value = value.trim();

    // Arrays: [item1, item2, ...]
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    }

    // Booleans
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Numbers
    if (/^\d+(\.\d+)?$/.test(value)) return Number(value);

    // Strings (strip quotes if present)
    return value.replace(/^["']|["']$/g, '');
}

function loadConfig() {
    const config = { ...defaults };

    if (!fs.existsSync(CONFIG_PATH)) {
        return config;
    }

    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key in defaults) {
            config[key] = parseValue(value);
        }
    }

    return config;
}

const config = loadConfig();

// World types supported by the server generator.
const WORLD_TYPES = ['flat', 'normal', 'amplified'];
const worldType = String(config.worldType || 'flat').toLowerCase().trim();
config.worldType = WORLD_TYPES.includes(worldType) ? worldType : 'flat';

module.exports = config;
