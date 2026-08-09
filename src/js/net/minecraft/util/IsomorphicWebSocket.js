const isNode = typeof window === 'undefined' && typeof process !== 'undefined';

let NativeWS = null;
let NativeServer = null;

if (isNode) {
    try {
        const wsModule = await import('ws');
        NativeWS = wsModule.WebSocket || wsModule.default;
        NativeServer = wsModule.WebSocketServer || wsModule.Server;
    } catch {
        if (typeof globalThis.WebSocket !== 'undefined') {
            NativeWS = globalThis.WebSocket;
        }
    }
} else {
    NativeWS = window.WebSocket;
}

export class LoopbackServer {
    #listeners = new Set();

    onConnection(callback) {
        this.#listeners.add(callback);
    }

    offConnection(callback) {
        this.#listeners.delete(callback);
    }

    connectClient(clientSocket) {
        const serverSocket = new LoopbackSocket('server');

        clientSocket._pair(serverSocket);
        serverSocket._pair(clientSocket);

        setTimeout(() => {
            serverSocket._readyState = 1;
            clientSocket._readyState = 1;

            this.#listeners.forEach((listener) => listener(serverSocket));

            const openEvent = new Event('open');
            if (typeof clientSocket.onopen === 'function') {
                clientSocket.onopen(openEvent);
            }
            clientSocket.dispatchEvent(openEvent);
        }, 0);
    }
}

export const globalLoopbackServer = new LoopbackServer();

export class LoopbackSocket extends EventTarget {
    #peer = null;

    constructor(role = 'client') {
        super();
        this.role = role;
        this._readyState = 0;
        this.binaryType = 'arraybuffer';

        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
    }

    get readyState() {
        return this._readyState;
    }

    _pair(peerSocket) {
        this.#peer = peerSocket;
    }

    send(data) {
        if (this._readyState !== 1) {
            throw new Error('WebSocket is not open');
        }

        let formattedData = data;
        if (this.binaryType === 'arraybuffer' && data instanceof ArrayBuffer) {
            formattedData = data;
        } else if (ArrayBuffer.isView(data)) {
            formattedData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }

        setTimeout(() => {
            if (!this.#peer || this.#peer.readyState !== 1) return;

            const messageEvent = new MessageEvent('message', { data: formattedData });
            if (typeof this.#peer.onmessage === 'function') {
                this.#peer.onmessage(messageEvent);
            }
            this.#peer.dispatchEvent(messageEvent);
        }, 0);
    }

    close(code = 1000, reason = '') {
        if (this._readyState === 3) return;
        this._readyState = 3;

        setTimeout(() => {
            const closeEvent = new CloseEvent('close', { code, reason, wasClean: true });

            if (typeof this.onclose === 'function') this.onclose(closeEvent);
            this.dispatchEvent(closeEvent);

            if (this.#peer && this.#peer.readyState !== 3) {
                this.#peer._readyState = 3;
                if (typeof this.#peer.onclose === 'function') this.#peer.onclose(closeEvent);
                this.#peer.dispatchEvent(closeEvent);
            }
        }, 0);
    }
}

export class IsomorphicWebSocket extends EventTarget {
    #socket = null;
    #binaryType = 'arraybuffer';
    #userOnOpen = null;
    #userOnMessage = null;
    #userOnError = null;
    #userOnClose = null;

    constructor(url, options = {}) {
        super();
        this.url = url;
        
        const isUrlLoopback = typeof url === 'string' && (
            url === 'ws://loopback' || 
            url === 'wss://loopback' || 
            url.startsWith('loopback://') || 
            url === 'loopback'
        );
        
        this.isLoopback = options.loopback || isUrlLoopback;

        if (this.isLoopback) {
            this.#socket = new LoopbackSocket('client');
            this.#setupLoopbackForwarding();
            globalLoopbackServer.connectClient(this.#socket);
        } else {
            if (!NativeWS) {
                throw new Error('No native WebSocket engine found in this runtime environment.');
            }
            this.#socket = new NativeWS(url, options.protocols);
            this.#socket.binaryType = this.#binaryType;
            this.#setupNativeForwarding();
        }
    }

    get readyState() {
        return this.#socket.readyState;
    }

    get binaryType() {
        return this.#binaryType;
    }

    set binaryType(val) {
        this.#binaryType = val;
        if (this.#socket) {
            this.#socket.binaryType = val;
        }
    }

    send(data) {
        this.#socket.send(data);
    }

    close(code, reason) {
        this.#socket.close(code, reason);
    }

    get onopen() {
        return this.isLoopback ? this.#socket.onopen : this.#userOnOpen;
    }

    set onopen(fn) {
        if (this.isLoopback) {
            this.#socket.onopen = fn;
        } else {
            this.#userOnOpen = fn;
        }
    }

    get onmessage() {
        return this.isLoopback ? this.#socket.onmessage : this.#userOnMessage;
    }

    set onmessage(fn) {
        if (this.isLoopback) {
            this.#socket.onmessage = fn;
        } else {
            this.#userOnMessage = fn;
        }
    }

    get onerror() {
        return this.isLoopback ? this.#socket.onerror : this.#userOnError;
    }

    set onerror(fn) {
        if (this.isLoopback) {
            this.#socket.onerror = fn;
        } else {
            this.#userOnError = fn;
        }
    }

    get onclose() {
        return this.isLoopback ? this.#socket.onclose : this.#userOnClose;
    }

    set onclose(fn) {
        if (this.isLoopback) {
            this.#socket.onclose = fn;
        } else {
            this.#userOnClose = fn;
        }
    }

    // Clone the event to avoid "The event is already being dispatched" errors.
    // queueMicrotask can run before the native dispatch loop finishes, so
    // deferring doesn't work reliably.
    #forwardEvent(e) {
        let clonedEvent;

        if (typeof MessageEvent !== 'undefined' && e instanceof MessageEvent) {
            clonedEvent = new MessageEvent(e.type, {
                data: e.data,
                origin: e.origin,
                lastEventId: e.lastEventId,
                source: e.source,
                ports: e.ports
            });
        } else if (typeof CloseEvent !== 'undefined' && e instanceof CloseEvent) {
            clonedEvent = new CloseEvent(e.type, {
                code: e.code,
                reason: e.reason,
                wasClean: e.wasClean
            });
        } else {
            clonedEvent = new Event(e.type, {
                bubbles: e.bubbles,
                cancelable: e.cancelable,
                composed: e.composed
            });
        }

        this.dispatchEvent(clonedEvent);
    }

    #setupLoopbackForwarding() {
        ['open', 'message', 'error', 'close'].forEach((event) => {
            this.#socket.addEventListener(event, (e) => this.#forwardEvent(e));
        });
    }

    #setupNativeForwarding() {
        this.#socket.onopen = (e) => {
            if (typeof this.#userOnOpen === 'function') this.#userOnOpen(e);
            this.#forwardEvent(e);
        };
        this.#socket.onmessage = (e) => {
            if (typeof this.#userOnMessage === 'function') this.#userOnMessage(e);
            this.#forwardEvent(e);
        };
        this.#socket.onerror = (e) => {
            if (typeof this.#userOnError === 'function') this.#userOnError(e);
            this.#forwardEvent(e);
        };
        this.#socket.onclose = (e) => {
            if (typeof this.#userOnClose === 'function') this.#userOnClose(e);
            this.#forwardEvent(e);
        };
    }
}

export class IsomorphicServer {
    static create(options = {}, connectionCallback) {
        if (isNode && NativeServer) {
            const wss = new NativeServer(options);
            if (connectionCallback) wss.on('connection', connectionCallback);
            return wss;
        }

        if (connectionCallback) {
            globalLoopbackServer.onConnection(connectionCallback);
        }
        return globalLoopbackServer;
    }
}

export default IsomorphicWebSocket;