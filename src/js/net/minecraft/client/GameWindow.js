import Minecraft from "./Minecraft.js";
import FocusStateType from "../util/FocusStateType.js";
import GuiIngameMenu from "./gui/screens/GuiIngameMenu.js";
import Keyboard from "../util/Keyboard.js";
import GuiLoadingScreen from "./gui/screens/GuiLoadingScreen.js";

export default class GameWindow {

    constructor(minecraft, canvasWrapperId) {
        this.minecraft = minecraft;

        this.width = 0;
        this.height = 0;

        this.mouseX = 0;
        this.mouseY = 0;

        this.mouseMotionX = 0;
        this.mouseMotionY = 0;

        this.mouseInsideWindow = false;
        this.mouseButtons = [false, false, false];

        this.mouseDownInterval = null;
        this.focusState = FocusStateType.EXITED;
        this.lastIngameSwitchTime = 0;

        this.mobileDevice = this.detectTouchDevice();

        // Initialize canvas elements
        this.initializeElements(canvasWrapperId);

        // Register listeners
        if (this.mobileDevice) {
            this.registerMobileListeners();
        } else {
            this.registerDesktopListeners();
        }

        // Create keyboard
        Keyboard.create();

        // TV mode: auto-lock focus and enable keyboard immediately
        if (this.minecraft.settings.tvmode) {
            this.mouseInsideWindow = true;
            Keyboard.setEnabled(true);
            this.updateFocusState(FocusStateType.LOCKED);
        }
    }

    initializeElements(canvasWrapperId) {
        // Get canvas wrapper
        this.wrapper = document.getElementById(canvasWrapperId);

        // Remove all children of wrapper
        while (this.wrapper.firstChild) {
            this.wrapper.removeChild(this.wrapper.firstChild);
        }

        // Create render layers
        this.canvasWorld = document.createElement('canvas');
        this.canvasDebug = document.createElement('canvas');
        this.canvasChat = document.createElement('canvas');
        this.canvasPlayerList = document.createElement('canvas');
        this.canvasItems = document.createElement('canvas');
        this.canvasGuiItemCount = document.createElement('canvas');

        // Create canvas renderer
        this.canvas = document.createElement('canvas');
        this.wrapper.appendChild(this.canvas);
    }

    registerDesktopListeners() {
        this.registerListener(window, 'resize', event => {
            this.updateWindowSize();
        });
        this.registerListener(document, 'mousedown', event => {
            // In-Game mouse click
            this.minecraft.onMouseClicked(event.button);

            this.mouseButtons[event.button] = true;

            // Start interval to repeat the mouse event
            if (this.mouseDownInterval !== null) {
                clearInterval(this.mouseDownInterval);
            }
            this.mouseDownInterval = setInterval(_ => this.minecraft.onMouseClicked(event.button), 250);

            // Handle mouse click on screen
            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen !== null) {
                currentScreen.mouseClicked(
                    event.x / this.scaleFactor,
                    event.y / this.scaleFactor,
                    event.button
                );
            }

            // Fix cursor lock state
            this.requestCursorUpdate();

            // Request lock on click
            if (this.minecraft.currentScreen === null && this.focusState === FocusStateType.EXITED) {
                this.updateFocusState(FocusStateType.REQUEST_LOCK);
            }

            this.initialSoundEngine();
        });
        this.registerListener(document, 'mousemove', event => {
            this.mouseX = event.clientX / this.scaleFactor;
            this.mouseY = event.clientY / this.scaleFactor;

            this.mouseMotionX += event.movementX;
            this.mouseMotionY += -event.movementY;

            // Handle mouse move on screen
            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen !== null) {
                currentScreen.mouseDragged(event.x / this.scaleFactor, event.y / this.scaleFactor, event.button);
            }

            this.requestCursorUpdate();
        });
        this.registerListener(document, 'mouseup', event => {
            // Handle mouse release on screen
            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen !== null) {
                currentScreen.mouseReleased(
                    event.x / this.scaleFactor,
                    event.y / this.scaleFactor,
                    event.button
                );
            }

            this.mouseButtons[event.button] = false;

            if (this.mouseDownInterval !== null) {
                clearInterval(this.mouseDownInterval);
            }
        });
        this.registerListener(document, 'pointerlockchange', event => {
            // Skip pointer lock handling in TV mode or on touch devices
            if (this.minecraft.settings.tvmode || this.mobileDevice) {
                return;
            }

            let intentState = this.focusState.getIntent();
            let isCursorLocked = this.isCursorLockedToCanvas();
            let isLockIntent = intentState === FocusStateType.LOCKED;

            let lastSwitchDuration = Date.now() - this.lastIngameSwitchTime;
            if (this.focusState === FocusStateType.LOCKED && !isCursorLocked && lastSwitchDuration < 200) {
                this.focusState = FocusStateType.REQUEST_LOCK;
            } else {
                if (intentState === null) {
                    this.updateFocusState(isCursorLocked ? FocusStateType.LOCKED : FocusStateType.EXITED);
                } else if (isCursorLocked === isLockIntent) {
                    this.updateFocusState(intentState);
                }
            }
        });
        this.registerListener(this.wrapper, 'mouseover', event => {
            Keyboard.setEnabled(true);
            this.mouseInsideWindow = true;
            this.requestCursorUpdate();
        });
        this.registerListener(this.wrapper, 'mouseleave', event => {
            Keyboard.setEnabled(false);
            this.mouseInsideWindow = false;
            this.requestCursorUpdate();
        });
        this.registerListener(document, 'mouseout', event => {
            this.requestCursorUpdate();
        });
        this.registerListener(document, 'mouseenter', event => {
            this.requestCursorUpdate();
        });
        this.registerListener(window, 'keydown', event => {
            if (event.key !== 'F11') {
                event.preventDefault();
            }
            else {
                this.updateWindowSize();
            }

            if (!this.mouseInsideWindow && !this.minecraft.settings.tvmode) {
                return;
            }

            if (event.key === 'Escape' && this.minecraft.currentScreen === null) {
                this.updateFocusState(FocusStateType.REQUEST_EXIT);
                return;
            }

            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen === null) {
                this.minecraft.onKeyPressed(event.code);
            } else {
                currentScreen.keyTyped(event.code, event.key);
            }

            this.requestCursorUpdate();
        }, false);
        this.registerListener(window, 'keyup', event => {
            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen !== null) {
                currentScreen.keyReleased(event.code);
            }
        });
        this.registerListener(document, 'contextmenu');
        this.registerListener(this.wrapper, 'wheel', event => {
            event.stopPropagation();
            let delta = Math.sign(event.deltaY);
            this.minecraft.onMouseScroll(delta);
        });
    }

    registerMobileListeners() {
        this.mouseInsideWindow = true;
        Keyboard.setEnabled(true);

        this.registerListener(window, 'resize', () => {
            this.updateWindowSize();
        });

        // 1. Inject Styles
        if (!document.getElementById('mobile-controls-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-controls-styles';
            style.textContent = `
                #mobile-controls-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    pointer-events: none;
                    user-select: none;
                    -webkit-user-select: none;
                    touch-action: none;
                    font-family: sans-serif;
                    z-index: 9999;
                }
                .mobile-btn {
                    pointer-events: auto;
                    background: rgba(0, 0, 0, 0.25);
                    color: rgba(255, 255, 255, 0.7);
                    border: none;
                    padding: 0;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    touch-action: none;
                }
                .mobile-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: currentColor;
                }
                .mobile-btn:active {
                    background: rgba(255, 255, 255, 0.3);
                    color: #fff;
                }
                .joystick-zone {
                    position: absolute;
                    bottom: 30px;
                    width: 130px;
                    height: 130px;
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 50%;
                    pointer-events: auto;
                    touch-action: none;
                }
                #joystick-move-zone { left: 30px; }
                #joystick-look-zone { right: 30px; }

                .joystick-knob {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 45px;
                    height: 45px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }

                #mbtn-prev {
                    position: absolute;
                    bottom: 45px;
                    left: 170px;
                }
                #mbtn-next {
                    position: absolute;
                    bottom: 45px;
                    right: 170px;
                }
                .arrow-btn {
                    width: 42px;
                    height: 42px;
                }

                #mobile-actions {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 12px;
                }
                .action-btn {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                }

                #mobile-gui-close {
                    position: fixed;
                    top: 15px;
                    right: 15px;
                    width: 38px;
                    height: 38px;
                    z-index: 10000;
                    display: none;
                }
            `;
            document.head.appendChild(style);
        }

        // 2. Inject Overlay & GUI Close Elements with SVG Icons
        let overlay = document.getElementById('mobile-controls-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mobile-controls-overlay';
            overlay.innerHTML = `
                <div id="joystick-move-zone" class="joystick-zone">
                    <div id="joystick-move-knob" class="joystick-knob"></div>
                </div>
                <button class="mobile-btn arrow-btn" id="mbtn-prev">
                    <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                </button>

                <div id="joystick-look-zone" class="joystick-zone">
                    <div id="joystick-look-knob" class="joystick-knob"></div>
                </div>
                <button class="mobile-btn arrow-btn" id="mbtn-next">
                    <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </button>

                <div id="mobile-actions">
                    <!-- Crouch / Shift Icon (Down Arrow) -->
                    <button class="mobile-btn action-btn" id="mbtn-shift">
                        <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    </button>
                    <!-- Jump / Fly Icon (Up Arrow) -->
                    <button class="mobile-btn action-btn" id="mbtn-space">
                        <svg viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
                    </button>
                    <!-- Inventory Icon (Backpack) -->
                    <button class="mobile-btn action-btn" id="mbtn-e">
                        <svg viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
                    </button>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        let guiCloseBtn = document.getElementById('mobile-gui-close');
        if (!guiCloseBtn) {
            guiCloseBtn = document.createElement('button');
            guiCloseBtn.id = 'mobile-gui-close';
            guiCloseBtn.className = 'mobile-btn';
            guiCloseBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
            document.body.appendChild(guiCloseBtn);
        }

        this.mobileOverlay = overlay;
        this.guiCloseBtn = guiCloseBtn;

        // Close GUI Button Handler
        guiCloseBtn.addEventListener('touchstart', e => {
            e.preventDefault();
            let currentScreen = this.minecraft.currentScreen;
            if (currentScreen !== null) {
                currentScreen.keyTyped("Escape", "Escape");
            }
        }, { passive: false });

        // 3. Setup Joysticks Logic
        const setupJoystick = (zoneId, knobId, onMove, onRelease) => {
            const zone = document.getElementById(zoneId);
            const knob = document.getElementById(knobId);
            let activeTouchId = null;
            const maxRadius = 45;

            const handleMove = (clientX, clientY) => {
                const rect = zone.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let deltaX = clientX - centerX;
                let deltaY = clientY - centerY;
                const distance = Math.hypot(deltaX, deltaY);

                if (distance > maxRadius) {
                    deltaX = (deltaX / distance) * maxRadius;
                    deltaY = (deltaY / distance) * maxRadius;
                }

                knob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
                onMove(deltaX / maxRadius, deltaY / maxRadius);
            };

            const reset = () => {
                activeTouchId = null;
                knob.style.transform = 'translate(-50%, -50%)';
                onRelease();
            };

            zone.addEventListener('touchstart', e => {
                e.preventDefault();
                if (activeTouchId !== null) return;
                const touch = e.changedTouches[0];
                activeTouchId = touch.identifier;
                handleMove(touch.clientX, touch.clientY);
            }, { passive: false });

            window.addEventListener('touchmove', e => {
                if (activeTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                        break;
                    }
                }
            }, { passive: false });

            window.addEventListener('touchend', e => {
                if (activeTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        reset();
                        break;
                    }
                }
            }, { passive: false });
        };

        // Left Joystick -> Movement (WASD)
        setupJoystick('joystick-move-zone', 'joystick-move-knob', (normX, normY) => {
            const threshold = 0.3;
            Keyboard.setState("KeyW", normY < -threshold);
            Keyboard.setState("KeyS", normY > threshold);
            Keyboard.setState("KeyA", normX < -threshold);
            Keyboard.setState("KeyD", normX > threshold);
        }, () => {
            Keyboard.setState("KeyW", false);
            Keyboard.setState("KeyS", false);
            Keyboard.setState("KeyA", false);
            Keyboard.setState("KeyD", false);
        });

        // Right Joystick -> Look Rotation Loop
        let lookVectorX = 0;
        let lookVectorY = 0;

        setupJoystick('joystick-look-zone', 'joystick-look-knob', (normX, normY) => {
            lookVectorX = normX;
            lookVectorY = normY;
        }, () => {
            lookVectorX = 0;
            lookVectorY = 0;
        });

        // Continuous Look & Mobile State Update Loop
        setInterval(() => {
            if (this.minecraft.currentScreen === null && (lookVectorX !== 0 || lookVectorY !== 0)) {
                this.mouseMotionX += lookVectorX * 12;
                this.mouseMotionY += -lookVectorY * 12;
            }
            this.updateMobileUIState();
        }, 16);

        // 4. Minecraft PE Place / Break System + GUI Pass-Through
        let peTouchId = null;
        let peStartX = 0;
        let peStartY = 0;
        let peStartTime = 0;
        let peBreakInterval = null;
        let isBreaking = false;

        this.registerListener(window, 'touchstart', event => {
            this.initialSoundEngine();

            if (this.minecraft.currentScreen !== null) {
                for (let i = 0; i < event.changedTouches.length; i++) {
                    let touch = event.changedTouches[i];
                    if (touch.target.closest('#mobile-gui-close')) continue;

                    this.minecraft.currentScreen.mouseClicked(
                        touch.clientX / this.scaleFactor,
                        touch.clientY / this.scaleFactor,
                        0
                    );
                }
                return;
            }

            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                if (touch.target.closest('#mobile-controls-overlay, #mobile-gui-close')) continue;

                if (peTouchId === null) {
                    peTouchId = touch.identifier;
                    peStartX = touch.clientX;
                    peStartY = touch.clientY;
                    peStartTime = Date.now();
                    isBreaking = false;

                    if (peBreakInterval) clearInterval(peBreakInterval);

                    peBreakInterval = setInterval(() => {
                        if (peTouchId !== null && (Date.now() - peStartTime) >= 200) {
                            isBreaking = true;
                            this.minecraft.onMouseClicked(0); // Break block
                        }
                    }, 180);
                }
            }
        }, false);

        this.registerListener(window, 'touchmove', event => {
            if (this.minecraft.currentScreen !== null) {
                for (let i = 0; i < event.changedTouches.length; i++) {
                    let touch = event.changedTouches[i];
                    this.minecraft.currentScreen.mouseDragged(
                        touch.clientX / this.scaleFactor,
                        touch.clientY / this.scaleFactor,
                        0
                    );
                }
                return;
            }

            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                if (touch.identifier === peTouchId) {
                    let dist = Math.hypot(touch.clientX - peStartX, touch.clientY - peStartY);
                    if (dist > 15) {
                        if (peBreakInterval) clearInterval(peBreakInterval);
                        peTouchId = null;
                    }
                }
            }
        }, false);

        this.registerListener(window, 'touchend', event => {
            if (this.minecraft.currentScreen !== null) {
                for (let i = 0; i < event.changedTouches.length; i++) {
                    let touch = event.changedTouches[i];
                    this.minecraft.currentScreen.mouseReleased(
                        touch.clientX / this.scaleFactor,
                        touch.clientY / this.scaleFactor,
                        0
                    );
                }
                return;
            }

            for (let i = 0; i < event.changedTouches.length; i++) {
                let touch = event.changedTouches[i];
                if (touch.identifier === peTouchId) {
                    if (peBreakInterval) clearInterval(peBreakInterval);

                    if (!isBreaking && (Date.now() - peStartTime) < 200) {
                        this.minecraft.onMouseClicked(2); // Place block
                    }

                    peTouchId = null;
                    isBreaking = false;
                }
            }
        }, false);

        // 5. Action Buttons & Arrow Hotbar Handlers + Double-Tap Fly
        const bindKeyButton = (elementId, keyCode) => {
            const btn = document.getElementById(elementId);
            if (!btn) return;

            btn.addEventListener('touchstart', e => {
                e.preventDefault();
                Keyboard.setState(keyCode, true);
                if (this.minecraft.currentScreen === null) {
                    this.minecraft.onKeyPressed(keyCode);
                }
            }, { passive: false });

            btn.addEventListener('touchend', e => {
                e.preventDefault();
                Keyboard.setState(keyCode, false);
            }, { passive: false });
        };

        bindKeyButton('mbtn-shift', 'ShiftLeft');
        bindKeyButton('mbtn-e', 'KeyE');

        // Jump button with double-tap detector for flight (KeyF)
        let lastSpaceTap = 0;
        const spaceBtn = document.getElementById('mbtn-space');
        if (spaceBtn) {
            spaceBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                const now = Date.now();

                // Double-tap space within 300ms toggles flight
                if (now - lastSpaceTap < 300) {
                    if (this.minecraft.currentScreen === null) {
                        this.minecraft.onKeyPressed("KeyF");
                    }
                }
                lastSpaceTap = now;

                Keyboard.setState("Space", true);
                if (this.minecraft.currentScreen === null) {
                    this.minecraft.onKeyPressed("Space");
                }
            }, { passive: false });

            spaceBtn.addEventListener('touchend', e => {
                e.preventDefault();
                Keyboard.setState("Space", false);
            }, { passive: false });
        }

        document.getElementById('mbtn-prev').addEventListener('touchstart', e => {
            e.preventDefault();
            this.minecraft.onMouseScroll(-1);
        }, { passive: false });

        document.getElementById('mbtn-next').addEventListener('touchstart', e => {
            e.preventDefault();
            this.minecraft.onMouseScroll(1);
        }, { passive: false });

        this.registerListener(document, 'contextmenu');
    }

    updateMobileUIState() {
        if (!this.mobileDevice) return;

        const hasScreen = this.minecraft.currentScreen !== null;

        if (this.mobileOverlay) {
            this.mobileOverlay.style.display = hasScreen ? 'none' : 'block';
        }

        if (this.guiCloseBtn) {
            this.guiCloseBtn.style.display = hasScreen ? 'flex' : 'none';
        }
    }

    updateWindowSize() {
        this.updateScaleFactor();

        let wrapperWidth = this.width * this.scaleFactor;
        let wrapperHeight = this.height * this.scaleFactor;

        let worldRenderer = this.minecraft.worldRenderer;
        let itemRenderer = this.minecraft.itemRenderer;

        worldRenderer.camera.aspect = this.width / this.height;
        worldRenderer.camera.updateProjectionMatrix();
        worldRenderer.webRenderer.setSize(wrapperWidth, wrapperHeight);

        itemRenderer.camera.aspect = this.width / this.height;
        itemRenderer.camera.updateProjectionMatrix();
        itemRenderer.webRenderer.setSize(wrapperWidth, wrapperHeight);
        if (itemRenderer.ctx2d) {
            let guiScale = Math.min(this.scaleFactor, 4);
            itemRenderer.canvas2d.width = this.width * guiScale;
            itemRenderer.canvas2d.height = this.height * guiScale;
            itemRenderer.ctx2d.imageSmoothingEnabled = false;
        }

        this.canvas.style.width = wrapperWidth + "px";
        this.canvas.style.height = wrapperHeight + "px";

        if (this.canvasDebug.width !== this.canvas.width || this.canvasDebug.height !== this.canvas.height) {
            this.canvasDebug.width = this.canvas.width;
            this.canvasDebug.height = this.canvas.height;
        }

        if (this.canvasChat.width !== this.canvas.width || this.canvasChat.height !== this.canvas.height) {
            this.canvasChat.width = this.canvas.width;
            this.canvasChat.height = this.canvas.height;
        }

        if (this.canvasPlayerList.width !== this.canvas.width || this.canvasPlayerList.height !== this.canvas.height) {
            this.canvasPlayerList.width = this.canvas.width;
            this.canvasPlayerList.height = this.canvas.height;
        }

        if (this.canvasGuiItemCount.width !== this.canvas.width || this.canvasGuiItemCount.height !== this.canvas.height) {
            this.canvasGuiItemCount.width = this.canvas.width;
            this.canvasGuiItemCount.height = this.canvas.height;
        }

        this.minecraft.screenRenderer.initialize();

        if (this.minecraft.currentScreen !== null) {
            this.minecraft.currentScreen.setup(this.minecraft, this.width, this.height);
        }

        this.minecraft.ingameOverlay.chatOverlay.setDirty();

        if (this.minecraft.isInGame()) {
            this.minecraft.worldRenderer.render(0);
            this.minecraft.onRender(0)
        }
    }

    updateScaleFactor() {
        let wrapperWidth = this.wrapper.offsetWidth;
        let wrapperHeight = this.wrapper.offsetHeight;

        let scale;
        for (scale = 1; wrapperWidth / (scale + 1) >= 320 && wrapperHeight / (scale + 1) >= 240; scale++) {
            // Empty
        }

        this.scaleFactor = scale;
        this.width = Math.ceil(wrapperWidth / scale);
        this.height = Math.ceil(wrapperHeight / scale);
    }

    isCursorLockedToCanvas() {
        return document.pointerLockElement === this.canvas;
    }

    isLocked() {
        return this.focusState.isLock() && this.minecraft.currentScreen === null;
    }

    updateFocusState(state) {
        if (state.getIntent() === this.focusState || state === this.focusState) {
            return;
        }

        let prevLock = this.focusState.isLock();
        let nextLock = state.isLock();

        if (this.minecraft.settings.tvmode) {
            if (state === FocusStateType.REQUEST_LOCK) {
                state = FocusStateType.LOCKED;
            } else if (state === FocusStateType.REQUEST_EXIT) {
                state = FocusStateType.EXITED;
            }
            nextLock = state.isLock();
            if (prevLock === nextLock && this.focusState === state) {
                return;
            }
        }

        this.focusState = state;
        document.body.style.cursor = (nextLock && !this.mobileDevice) ? 'none' : 'default';

        this.requestCursorUpdate();

        if (prevLock !== nextLock) {
            let currentScreen = this.minecraft.currentScreen;

            if (currentScreen === null && !nextLock) {
                this.minecraft.displayScreen(new GuiIngameMenu());
            }

            if (!(currentScreen instanceof GuiLoadingScreen) && nextLock) {
                this.minecraft.displayScreen(null);
                this.lastIngameSwitchTime = Date.now();
            }
        }

        this.updateMobileUIState();
    }

    requestCursorUpdate() {
        if (this.minecraft.settings.tvmode || this.mobileDevice) {
            return;
        }

        if (this.mouseInsideWindow && this.focusState.isLock() !== this.isCursorLockedToCanvas()) {
            if (this.focusState.isLock()) {
                this.canvas.requestPointerLock();
            } else {
                document.exitPointerLock();
            }
        }
    }

    detectTouchDevice() {
        const isCoarseOnly = window.matchMedia("(pointer: coarse) and not (pointer: fine)").matches;
        const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

        return isCoarseOnly || (isMobileUA && navigator.maxTouchPoints > 0);
    }

    getMemoryLimit() {
        return this.getMemoryValue("jsHeapSizeLimit", 1);
    }

    getMemoryAllocated() {
        return this.getMemoryValue("totalJSHeapSize", 0);
    }

    getMemoryUsed() {
        return this.getMemoryValue("usedJSHeapSize", 0);
    }

    getMemoryValue(key, fallbackValue = 0) {
        let performance = window.performance || window.msPerformance || window.webkitPerformance || window.mozPerformance;
        if (performance && performance.memory && performance.memory[key]) {
            return performance.memory[key];
        }
        return fallbackValue;
    }

    getGPUName() {
        let gl = this.canvasWorld.getContext("webgl2");
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }

    openUrl(url, newTab) {
        if (newTab) {
            window.open(url, '_blank').focus();
        } else {
            window.location = url;
        }
    }

    close() {
        this.openUrl(Minecraft.URL_GITHUB);
    }

    async getClipboardText() {
        return navigator.clipboard.readText();
    }

    isMobileDevice() {
        return this.mobileDevice;
    }

    pullMouseMotionX() {
        let value = this.mouseMotionX;
        this.mouseMotionX = 0;
        return value;
    }

    pullMouseMotionY() {
        let value = this.mouseMotionY;
        this.mouseMotionY = 0;
        return value;
    }

    initialSoundEngine() {
        if (!this.minecraft.soundManager.isCreated()) {
            this.minecraft.soundManager.create(this.minecraft.worldRenderer);
        }
    }

    registerListener(parent, event, listener = null, preventDefaults = true) {
        parent.addEventListener(event, event => {
            if (preventDefaults) {
                event.preventDefault();
            }

            if (listener !== null) {
                listener(event);
            }
        });
    }
}