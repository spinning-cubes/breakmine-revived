const colors = require('colors');

/**
 * Formats and logs a message
 * @param {string} level - The log level (e.g., 'INFO', 'WARN', 'ERROR').
 * @param {string} thread - The thread name (e.g., 'Server thread', 'main').
 * @param {string} message - The message content.
 * @param {function} colorFn - The color function from the 'colors' library to apply to the level/thread text.
 */
function logLevel(level, thread, message, colorFn = colors.white) {
    const now = new Date();
    const time = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join(':');

    const prefix = `[${time}] [${thread}/${level}]`.white.bold;
    const coloredPrefix = `[${time}] ${colorFn(`[${thread}/${level}]`)}`;

    console.log(`${coloredPrefix}: ${message}`);
}

let rl = null;

const Logger = {
    info: (thread, message) => {
        logLevel('INFO', thread, message, colors.green);
        rl?.prompt(true);
    },
    warn: (thread, message) => {
        logLevel('WARN', thread, message, colors.yellow);
        rl?.prompt(true);
    },
    error: (thread, message) => {
        logLevel('ERROR', thread, message, colors.red);
        rl?.prompt(true);
    },
    debug: (thread, message) => {
        logLevel('DEBUG', thread, message, colors.cyan);
        rl?.prompt(true);
    },
    setRl: (newrl) => {
        rl = newrl;
    }
};

module.exports = Logger;