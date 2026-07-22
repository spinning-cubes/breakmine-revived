export default class Keyboard {

    static state = {};
    static enabled = false;

    // TV remote keycode → standard event.code mapping
    static TV_KEY_MAP = {
        4: 'Escape',      // Android TV / Fire TV Back
        461: 'Escape',    // LG webOS Back
        10009: 'Escape',  // Samsung Tizen Back
    };

    static mapKeyCode(event) {
        let code = Keyboard.TV_KEY_MAP[event.keyCode];
        if (code) {
            return code;
        }
        return event.code;
    }

    static create() {
        window.addEventListener('keydown', event => {
            let code = Keyboard.mapKeyCode(event);
            Keyboard.state[code] = true;
        });
        window.addEventListener('keyup', event => {
            event.preventDefault();
            let code = Keyboard.mapKeyCode(event);
            delete Keyboard.state[code];
        });

        Keyboard.setEnabled(true);
    };

    static setState(key, state) {
        Keyboard.state[key] = state;
    }

    static unPressAll() {
        Keyboard.state = {};
    }

    static isKeyDown(key) {
        return Keyboard.state[key] && Keyboard.enabled;
    }

    static setEnabled(enabled) {
        Keyboard.enabled = enabled;

        if (!enabled) {
            Keyboard.unPressAll();
        }
    }

}