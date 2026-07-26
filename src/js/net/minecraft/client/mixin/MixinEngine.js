class MixinEngine {
    constructor() {
        this.registry = new Map();
        this.listeners = new Map();        // Standard modifying listeners
        this.guaranteedListeners = new Map(); // Non-cancellable listeners
        this.observers = new Map();        // Read-only observers
        this.lockedFunctions = new WeakMap(); // Protected functions that cannot be patched
    }

    register(key, target) {
        if (!key.includes(':')) {
            console.warn(`[Mixin] Key '${key}' should follow 'namespace:name' format.`);
        }
        this.registry.set(key, target);
        return target;
    }

    get(key) {
        return this.registry.get(key);
    }

    /**
     * Prevents further mixins/hooks from wrapping a specific method on an object.
     */
    lockFunction(target, methodName) {
        if (!target || typeof target[methodName] !== 'function') return;

        if (!this.lockedFunctions.has(target)) {
            this.lockedFunctions.set(target, new Set());
        }
        this.lockedFunctions.get(target).add(methodName);
    }

    apply(targetKey, mixinDef) {
        const target = typeof targetKey === 'string' ? this.registry.get(targetKey) : targetKey;

        if (!target || typeof target !== 'object') {
            console.error(`[Mixin] Target '${targetKey}' not found or invalid.`);
            return null;
        }

        // 1. Properties
        if (mixinDef.properties) {
            Object.assign(target, mixinDef.properties);
        }

        // 2. Methods / Functions
        if (mixinDef.methods) {
            const lockedSet = this.lockedFunctions.get(target);

            for (const [key, hooks] of Object.entries(mixinDef.methods)) {
                // Skip if method is marked non-cancellable / locked
                if (lockedSet && lockedSet.has(key)) {
                    console.warn(`[Mixin] Cannot apply mixin to locked method '${key}'.`);
                    continue;
                }

                const originalFn = target[key];

                if (typeof originalFn !== 'function') {
                    if (typeof hooks === 'function') {
                        target[key] = hooks;
                    } else if (hooks.around) {
                        target[key] = function (...args) {
                            return hooks.around.call(this, () => {}, ...args);
                        };
                    }
                    continue;
                }

                if (typeof hooks === 'function') {
                    target[key] = hooks;
                    continue;
                }

                target[key] = function (...args) {
                    if (hooks.before) hooks.before.call(this, args);

                    let result;
                    if (hooks.around) {
                        result = hooks.around.call(this, originalFn.bind(this), ...args);
                    } else {
                        result = originalFn.apply(this, args);
                    }

                    if (hooks.after) hooks.after.call(this, result, args);

                    return result;
                };
            }
        }

        return target;
    }

    on(eventKey, handler, priority = 0) {
        this._addListener(this.listeners, eventKey, handler, priority);
    }

    /**
     * Subscribes a non-cancellable listener.
     * Guaranteed to run regardless of cancellation state or early returns.
     */
    onGuaranteed(eventKey, handler, priority = 0) {
        this._addListener(this.guaranteedListeners, eventKey, handler, priority);
    }

    emit(eventKey, payload) {
        this.emitCancellable(eventKey, payload);
    }

    /**
     * Emits an event through normal cancellable handlers,
     * BUT ALWAYS executes guaranteed handlers afterwards.
     */
    emitCancellable(eventKey, payload) {
        let isCancelled = false;

        // 1. Run standard listeners (can be cancelled)
        const handlers = this.listeners.get(eventKey);
        if (handlers) {
            for (const { handler } of handlers) {
                const result = handler(payload);
                if (result === false || payload?.cancelled) {
                    isCancelled = true;
                    if (payload) payload.cancelled = true;
                    break; // Stop standard chain on cancel
                }
            }
        }

        // 2. Run non-cancellable / guaranteed listeners (NEVER SKIPPED)
        const guaranteed = this.guaranteedListeners.get(eventKey);
        if (guaranteed) {
            for (const { handler } of guaranteed) {
                try {
                    handler(payload, isCancelled);
                } catch (err) {
                    console.error(`[Mixin] Error in guaranteed listener for '${eventKey}':`, err);
                }
            }
        }

        // 3. Notify read-only observers
        this._notifyObservers(eventKey, payload);

        return !isCancelled;
    }

    _addListener(map, key, handler, priority) {
        if (!map.has(key)) {
            map.set(key, []);
        }
        const list = map.get(key);
        list.push({ handler, priority });
        list.sort((a, b) => b.priority - a.priority);
    }

    observe(eventKey, callback) {
        if (!this.observers.has(eventKey)) {
            this.observers.set(eventKey, []);
        }
        this.observers.get(eventKey).push(callback);
    }

    _notifyObservers(eventKey, payload) {
        const list = this.observers.get(eventKey);
        if (!list || list.length === 0) return;

        const readOnlyPayload = typeof payload === 'object' && payload !== null
            ? Object.freeze({ ...payload })
            : payload;

        for (const callback of list) {
            try {
                callback(readOnlyPayload);
            } catch (err) {
                console.error(`[Mixin] Error in observer for '${eventKey}':`, err);
            }
        }
    }
}

// Global instance
globalThis.Mixin = new MixinEngine();