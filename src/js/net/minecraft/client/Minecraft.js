import Timer from "../util/Timer.js";
import GameSettings from "./GameSettings.js";
import GameWindow from "./GameWindow.js";
import Keyboard from "../util/Keyboard.js";
import WorldRenderer from "./render/WorldRenderer.js";
import ScreenRenderer from "./render/gui/ScreenRenderer.js";
import ItemRenderer from "./render/gui/ItemRenderer.js";
import IngameOverlay from "./gui/overlay/IngameOverlay.js";
import SoundManager from "./sound/SoundManager.js";
import MusicManager from "./sound/MusicManager.js";
import Block from "./world/block/Block.js";
import { ToolRegistry } from "./world/tool/ToolRegistry.js";
import BoundingBox from "../util/BoundingBox.js";
import {BlockRegistry} from "./world/block/BlockRegistry.js";
import FontRenderer from "./render/gui/FontRenderer.js";
import GrassColorizer from "./render/GrassColorizer.js";
import GuiMainMenu from "./gui/screens/GuiMainMenu.js";
import GuiLoadingScreen from "./gui/screens/GuiLoadingScreen.js";
import * as THREE from "../../../../../libraries/three.module.js";
import ParticleRenderer from "./render/particle/ParticleRenderer.js";
import ClientDropItemPacket from "./network/packet/play/client/ClientDropItemPacket.js";
import GuiChat from "./gui/screens/GuiChat.js";
import CommandHandler from "./command/CommandHandler.js";
import GuiContainerCreative from "./gui/screens/container/GuiContainerCreative.js";
import GameProfile from "../util/GameProfile.js";
import UUID from "../util/UUID.js";
import FocusStateType from "../util/FocusStateType.js";
import Session from "../util/Session.js";
import PlayerControllerMultiplayer from "./network/controller/PlayerControllerMultiplayer.js";
import ChunkProviderGenerateWorker from "./world/provider/ChunkProviderGenerateWorker.js";
import FileSystem from "./fs/Filesystem.js";
import generateUsername from "./UsernameGenerator.js";
import Vector3 from "../util/Vector3.js";
import MathHelper from "../util/MathHelper.js";
import BlockPosition from "../util/BlockPosition.js";
import GuiContainerSurvival from "./gui/screens/container/GuiContainerSurvival.js";
import CraftingRegistry from "./crafting/CraftingRegistry.js";
import GuiPrelaunch from "./gui/screens/GuiPrelaunch.js";
import ItemEntity from "./entity/ItemEntity.js";
import PlayerEntity from "./entity/PlayerEntity.js";
import { Version } from "../../../../resources/version.js";

export default class Minecraft {

    static VERSION = Version.VERSION //SCRIPT_SPECIAL_TOKEN_REPLACE_GITVERSION
    static TIMESTAMP = Version.TIMESTAMP //SCRIPT_SPECIAL_TOKEN_REPLACE_GITTIMESTAMP
    static URL_GITHUB = "https://codeberg.org/BreakmineDevelopers/breakmine_revived";
    static PROTOCOL_VERSION = 47; //758;

    // TODO Add to settings
    static PROXY = {
        "url": "ws://127.0.0.1:25565"
    };

    /**
     * Create Minecraft instance and render it on a canvas
     */
    constructor(canvasWrapperId, resources) {
        this.resources = resources;

        this.currentScreen = null;
        this.loadingScreen = null;
        this.world = null;
        this.player = null;
        this.playerController = null;
        this.fps = 0;
        this.maxFps = 0;

        // Tick timer
        this.timer = new Timer(20);

        this.settings = new GameSettings();
        this.settings.load();

        // Auto-detect Smart TV platform and enable TV mode on first visit
        if (!this.settings.tvmode && !document.cookie.includes('tvmode=')) {
            let ua = window.navigator.userAgent;
            if (/Tizen|SMART-TV|SmartTV/i.test(ua) && !/Mobile|Nexus|SM-/i.test(ua)) {
                this.settings.tvmode = true;
                this.settings.save();
            } else if (/webOS|Web0S|Roku|AFTS|AFTB|AFTM|AFTT|AFTKA|FireTV|GoogleTV|Android TV|Large Screen|VIDAA|Viera|NetCast/i.test(ua)) {
                this.settings.tvmode = true;
                this.settings.save();
            }
        }

        // Load session from settings
        if (this.settings.session === null) {
            if (!this.settings.username) this.loggedIn = false;
            let username = this.settings.username || generateUsername();
            let profile = new GameProfile(UUID.randomUUID(), username);
            this.setSession(new Session(profile, ""));
        } else {
            this.setSession(Session.fromJson(this.settings.session));
        }

        // Create window and world renderer
        this.window = new GameWindow(this, canvasWrapperId);

        // Create renderers
        this.worldRenderer = new WorldRenderer(this, this.window);
        this.screenRenderer = new ScreenRenderer(this, this.window);
        this.itemRenderer = new ItemRenderer(this, this.window);

        // Create current screen and overlay
        this.ingameOverlay = new IngameOverlay(this, this.window);

        // Command handler
        this.commandHandler = new CommandHandler(this);

        this.frames = 0;
        this.lastTime = Date.now();

        // Create all blocks
        BlockRegistry.create();
        CraftingRegistry.reset();

        // Create all tools
        // (tools are needed for correct held-item rendering + inventory)
        // Lazy import is avoided here; ToolRegistry is a static registry.
        // ToolRegistry.create() currently registers default tool instances.
        ToolRegistry.create();

        this.blockList = BlockRegistry.getAllBlocks();

        this.itemRenderer.initialize();

        // Create font renderer
        this.fontRenderer = new FontRenderer(this);

        // Grass colorizer
        this.grassColorizer = new GrassColorizer(this);

        this.particleRenderer = new ParticleRenderer(this);

        // Update window size
        this.window.updateWindowSize();

        // Create sound manager
        this.soundManager = new SoundManager();
        this.musicManager = new MusicManager();

        // If in prelaunch mode; display the menu for it instead
        if (window.isPreLaunch) {
            console.log("Prelaunch mode; game won't start until menu is exited.");
            this.displayScreen(new GuiPrelaunch(this));
        } else {
            this.displayScreen(new GuiMainMenu());
        }

        // Create Filesystem
        this.fs = new FileSystem();

        // Create various player properties
        this.miningTimer = 0;
        this.maxMiningTicks = 30;
        this.lastBlockPos = null;
        this.isMining = false;

        // Initialize
        this.init();
    }

    newSessionFromUsername(username) {
        let profile = new GameProfile(UUID.randomUUID(), username);
        this.setSession(new Session(profile, ""), true);
    }

    init() {
        // Start render loop
        this.running = true;
        this.requestNextFrame();
    }

    loadWorld(world) {
        this.miningTimer = 0;
        this.lastBlockPos = null;
        this.musicManager.stopMusic();

        if (world === null) {
            this.worldRenderer.reset();
            this.itemRenderer.reset();

            // Disconnect from server
            if (this.playerController instanceof PlayerControllerMultiplayer) {
                let networkHandler = this.playerController.getNetworkHandler();
                if (networkHandler.getNetworkManager().isConnected()) {
                    networkHandler.getNetworkManager().close();
                }

                // Reset header and footer
                this.ingameOverlay.playerListOverlay.setHeader(null);
                this.ingameOverlay.playerListOverlay.setFooter(null);
            }
            this.playerController = null;

            if (this.world !== null) {
                this.world.cleanup();
                const provider = this.world.getChunkProvider();
                if (provider instanceof ChunkProviderGenerateWorker) {
                    provider.terminate();
                }
                this.world.getChunkProvider().getChunks().clear();
                this.world.clearEntities();
                this.world = null;
                this.player = null;
                this.loadingScreen = null;
            }
            this.displayScreen(new GuiMainMenu());
        } else {
            // Display loading screen
            this.loadingScreen = new GuiLoadingScreen();
            this.loadingScreen.setTitle("Building terrain...");
            this.displayScreen(this.loadingScreen);

            // Clear previous world
            if (this.world !== null) {
                this.world.getChunkProvider().getChunks().clear();
                this.world.clearEntities();
                this.worldRenderer.reset();
                this.itemRenderer.reset();
            }

            // Create world
            this.world = world;
            this.worldRenderer.scene.add(this.world.group);

            // Create player
            this.player = this.playerController.createPlayer(this.world);
            this.player.username = this.session.getProfile().getUsername();
            this.world.addEntity(this.player);

            if (this.player.renderer) {
                this.player.renderer.rebuild(this.player);
            }

            // Load spawn chunks and respawn player
            if (this.world.getChunkProvider() instanceof ChunkProviderGenerateWorker) {
                this._loadWorldAsync(world);
            } else {
                // Sync path: progress is tracked in onTick; spawn loading happens when done
            }
        }
    }

    async _loadWorldAsync(world) {
        const provider = world.getChunkProvider();
        const viewDistance = this.settings.viewDistance;
        const spawnChunkX = world.spawn.x >> 4;
        const spawnChunkZ = world.spawn.z >> 4;

        const coords = [];
        for (let x = -viewDistance; x <= viewDistance; x++) {
            for (let z = -viewDistance; z <= viewDistance; z++) {
                coords.push([spawnChunkX + x, spawnChunkZ + z]);
            }
        }

        const BATCH_SIZE = 16;
        for (let i = 0; i < coords.length; i += BATCH_SIZE) {
            const batch = coords.slice(i, i + BATCH_SIZE);
            await provider.loadChunksBatchAsync(batch);

            if (this.loadingScreen !== null) {
                const progress = Math.min(1, (i + batch.length) / coords.length);
                this.loadingScreen.setProgress(progress);
            }

            await new Promise(r => setTimeout(r, 0));
        }

        world.spawn.y = world.getHeightAt(world.spawn.x, world.spawn.z) + 8;
        this.player.respawn();

        if (this.loadingScreen !== null) {
            this.loadingScreen = null;
            this.displayScreen(null);
        }

        this.musicManager.playMusic('game');
    }

    hasInGameFocus() {
        if (this.settings.tvmode) {
            return this.currentScreen === null && this.isInGame();
        }
        return this.window.isLocked() && this.currentScreen === null;
    }

    isInGame() {
        return this.world !== null && this.worldRenderer !== null && this.player !== null;
    }

    addMessageToChat(message) {
        this.ingameOverlay.chatOverlay.addMessage(message);
    }

    requestNextFrame() {
        requestAnimationFrame(() => {
            if (this.running) {
                this.requestNextFrame();
                this.onLoop();
            }
        });
    }

    onLoop() {
        // Update the timer
        if (this.isPaused() && this.isInGame()) {
            let prevPartialTicks = this.timer.partialTicks;
            this.timer.advanceTime();
            this.timer.partialTicks = prevPartialTicks;
        } else {
            this.timer.advanceTime();
        }

        // Call the tick to reach updates 20 per seconds
        for (let i = 0; i < this.timer.ticks; i++) {
            this.onTick();
        }

        // Render the game
        this.onRender(this.timer.partialTicks);

        // Increase rendered frame
        this.frames++;

        // Loop if a second passed
        while (Date.now() >= this.lastTime + 1000) {
            this.fps = this.frames;
            this.maxFps = Math.max(this.maxFps, this.fps);
            this.lastTime += 1000;
            this.frames = 0;
        }
    }

    onRender(partialTicks) {
        if (this.isInGame()) {
            // Player rotation
            if (this.hasInGameFocus()) {
                let deltaX = this.window.pullMouseMotionX();
                let deltaY = this.window.pullMouseMotionY();
                this.player.turn(deltaX, deltaY);
            }

            // Update lights (limit iterations to prevent freezing)
            let lightIterations = 0;
            while (this.world.updateLights() && lightIterations < 100) {
                lightIterations++;
            }

            // Render the game
            if (this.isInGame() && !this.isPaused()) {
                this.worldRenderer.render(partialTicks);
            }
        }

        // Render items in GUI
        this.itemRenderer.render(partialTicks);

        // Render current screen
        this.screenRenderer.render(partialTicks);
    }

    displayScreen(screen) {
        if (screen === this.currentScreen) {
            return;
        }

        if (typeof screen === "undefined") {
            console.error("Tried to display an undefined screen");
            return;
        }

        if (screen && (screen.constructor.name === "GuiPrelaunch" || screen.constructor.name === "GuiLicense")) {
            document.title = "Breakmine | Pre-launch Environment";
        } else {
            document.title = "Breakmine";
        }

        if (Boolean(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]' )) {
            document.title = document.title + " (localhost)";
        }

        // Fallback screen
        if (screen === null && !this.isInGame()) {
            screen = new GuiMainMenu();
        }

        // Close previous screen
        if (this.currentScreen !== null) {
            this.currentScreen.onClose();
        }

        // Switch screen
        this.currentScreen = screen;

        // Update window size
        this.window.updateWindowSize();

        // Initialize new screen
        if (screen === null) {
            this.window.updateFocusState(FocusStateType.REQUEST_LOCK);
        } else {
            this.window.updateFocusState(FocusStateType.REQUEST_EXIT);
            screen.setup(this, this.window.width, this.window.height);

            // Play menu music when any screen is shown outside of a world
            if (!this.isInGame()) {
                this.musicManager.playMusic('menu');
            }
        }

        // Update items
        this.itemRenderer.rebuildAllItems();
    }

    onTick() {
        if (this.isInGame() && !this.isPaused()) {
            // Tick mining
            this.handleMiningTicks();

            // Tick overlay
            this.ingameOverlay.onTick();

            // Tick world
            this.world.onTick();

            // Tick renderer
            this.worldRenderer.onTick();

            // Tick particle renderer
            this.particleRenderer.onTick();
        }

        // Tick the screen
        if (this.currentScreen !== null) {
            this.currentScreen.updateScreen();
        }

        // Update loading progress (sync provider only; worker uses _loadWorldAsync)
        if (this.loadingScreen !== null && this.isInGame()
            && !(this.world.getChunkProvider() instanceof ChunkProviderGenerateWorker)) {
            let cameraChunkX = Math.floor(this.player.x) >> 4;
            let cameraChunkZ = Math.floor(this.player.z) >> 4;

            let renderDistance = this.settings.viewDistance;
            let requiredChunks = Math.pow(renderDistance * 2 - 1, 2);
            let loadedChunks = this.world.getChunkProvider().getChunks().size;

            // Load chunks and count
            setTimeout(() => {
                for (let x = -renderDistance + 1; x < renderDistance; x++) {
                    for (let z = -renderDistance + 1; z < renderDistance; z++) {
                        this.world.getChunkAt(cameraChunkX + x, cameraChunkZ + z);
                    }
                }
            }, 0);

            // Update progress
            let progress = 1 / requiredChunks * Math.max(0, loadedChunks - this.world.lightUpdateQueue.length / 1000);
            this.loadingScreen.setProgress(progress);

            // Finish loading
            if (progress >= 0.99) {
                this.world.loadSpawnChunks();
                this.player.respawn();
                this.musicManager.playMusic('game');
                this.loadingScreen = null;
                this.displayScreen(null);
            }
        }

        // Worker provider: request chunks around player during gameplay
        if (this.isInGame() && this.world !== null
            && this.world.getChunkProvider() instanceof ChunkProviderGenerateWorker
            && this.loadingScreen === null) {
            let cameraChunkX = Math.floor(this.player.x) >> 4;
            let cameraChunkZ = Math.floor(this.player.z) >> 4;
            let renderDistance = this.settings.viewDistance;

            this.world.getChunkProvider().requestChunksInRadius(cameraChunkX, cameraChunkZ, renderDistance);
        }
    }

    handleMiningTicks() {
        if (!this.window.isLocked() || this.player.creative === true || this.player.spectator === true) {
            this.miningTimer = 0;
            this.lastBlockPos = null;
            return;
        }

        let isLeftClickHeld = !!(this.window.mouseButtons && this.window.mouseButtons[0]);
        let hitResult = this.player.rayTrace(5, this.timer.partialTicks);

        if (!isLeftClickHeld || hitResult === null) {
            this.miningTimer = 0;
            this.lastBlockPos = null;
            return;
        }

        if (this.lastBlockPos !== null &&
            (this.lastBlockPos.x !== hitResult.x ||
            this.lastBlockPos.y !== hitResult.y ||
            this.lastBlockPos.z !== hitResult.z)) {
            
            this.lastBlockPos = { x: hitResult.x, y: hitResult.y, z: hitResult.z };
            this.miningTimer = 0;
            return;
        }

        if (this.lastBlockPos === null) {
            this.lastBlockPos = { x: hitResult.x, y: hitResult.y, z: hitResult.z };
        }

        let typeId = this.world.getBlockAt(hitResult.x, hitResult.y, hitResult.z);
        if (typeId === 0) {
            this.miningTimer = 0;
            this.lastBlockPos = null;
            return;
        }

        this.miningTimer++;

        if (this.miningTimer % 5 === 0) {
            this.player.swingArm();
            let block = Block.getById(typeId);
            let soundName = block.getSound().getBreakSound();

            this.soundManager.playSound(soundName, this.player.x + 0.5, this.player.y + 1.6, this.player.z + 0.5, 1.0, 0.3);
        }

        let block = Block.getById(typeId);
        let requiredTicks = Math.ceil(block.getHardness() * 30);

        if (this.miningTimer >= requiredTicks) {
            this.breakTargetBlock(hitResult, typeId);
            this.miningTimer = 0;
            this.lastBlockPos = null;
        }
    }

    breakTargetBlock(hitResult, typeId) {
        let block = Block.getById(typeId);
        let droppedBlock = block.getDrop(this.world, hitResult.x, hitResult.y, hitResult.z);
        let soundName = block.getSound().getBreakSound();

        this.soundManager.playSound(soundName, this.player.x + 0.5, this.player.y + 1.6, this.player.z + 0.5, 1.0, 1.0);

        this.particleRenderer.spawnBlockBreakParticle(this.world, hitResult.x, hitResult.y, hitResult.z);

        this.world.setBlockAt(hitResult.x, hitResult.y, hitResult.z, 0);
        this.player.swingArm();

        if (!this.player.creative) {
            this.player.inventory.addItem(droppedBlock[0], droppedBlock[1]);
        }

        if (!this.isSingleplayer()) {
            let blockPos = new BlockPosition(hitResult.x, hitResult.y, hitResult.z);
            this.playerController.sendBlockDiggingPacket(2, blockPos, 0);
        }

        this.worldRenderer.flushRebuild = true;
    }

    onKeyPressed(button) {
        // TV mode: color button actions
        if (this.settings.tvmode && this.hasInGameFocus()) {
            if (button === 'ColorRed') {
                this.onMouseClicked(0);
            }
            if (button === 'ColorGreen') {
                this.onMouseClicked(2);
            }
            if (button === 'ColorYellow') {
                this.displayScreen(this.player.creative ? new GuiContainerCreative(this.player) : new GuiContainerSurvival(this.player));
            }
            if (button === 'ColorBlue') {
                this.player.inventory.shiftSelectedSlot(1);
            }
        }

        // Select slot
        for (let i = 1; i <= 9; i++) {
            if (button === 'Digit' + i) {
                this.player.inventory.selectedSlotIndex = i - 1;
            }
        }

        // Toggle perspective
        if (button === this.settings.keyTogglePerspective) {
            this.settings.thirdPersonView = (this.settings.thirdPersonView + 1) % 3;
            this.settings.save();
        }

        // Open chat
        if (button === this.settings.keyOpenChat) {
            this.displayScreen(new GuiChat(this));
            this.ingameOverlay.chatOverlay.setDirty();
        }

        // Toggle debug overlay
        if (button === "F3") {
            this.settings.debugOverlay = !this.settings.debugOverlay;
            this.settings.save();
        }

        // Toggle chunk boundaries with F3 + G
        if (button === "KeyG" && Keyboard.isKeyDown("F3")) {
            this.settings.showChunkBoundaries = !this.settings.showChunkBoundaries;
            this.settings.save();
        }

        // Toggle entity bounding boxes with F3 + B
        if (button === "KeyB" && Keyboard.isKeyDown("F3")) {
            this.settings.showEntityBoundingBoxes = !this.settings.showEntityBoundingBoxes;
            this.settings.save();
        }

        // Drop held item
        if (button === "KeyQ") {
            if (this.player.spectator) return;
            if (this.player.inventory.getItemInSelectedSlot() !== 0 && this.player.inventory.getItemInSelectedSlot() !== null) {
                let itemStack = this.player.inventory.getItemInSelectedSlot();

                if (this.isSingleplayer()) {
                    // Singleplayer: create entity locally
                    this.world.addEntity(new ItemEntity(this, this.world, itemStack.typeId, this.player.x, this.player.y, this.player.z));
                } else {
                    // Multiplayer: tell server to spawn item for all players
                    this.playerController.getNetworkHandler().sendPacket(new ClientDropItemPacket(itemStack.typeId));
                }

                // Play drop sound
                this.soundManager.playSound('random.pop', this.player.x, this.player.y, this.player.z, 1.0, 1.0);

                // Decrease stack count by 1, or clear if only 1 item
                if (itemStack.count > 1) {
                    itemStack.count--;
                    this.player.inventory.setItemInSelectedSlot(itemStack);
                } else {
                    this.player.inventory.setItemInSelectedSlot(0);
                }
                this.itemRenderer.destroy("inventory");
                this.itemRenderer.scheduleDirty("hotbar");
            }
        }

        // Open inventory
        if (button === this.settings.keyOpenInventory) {
            if (this.player.spectator) return;
            this.displayScreen(this.player.creative ? new GuiContainerCreative(this.player) : new GuiContainerSurvival(this.player));
        }
    }

    onMouseClicked(button) {
        if (this.window.isLocked()) {
            // Spectators cannot interact with the world
            if (this.player.spectator) return;

            let hitResult = this.player.rayTrace(5, this.timer.partialTicks);

            // Attack entity
            if (button === 0) {
                let entity = this.rayTraceEntity(5, this.timer.partialTicks);
                if (entity && entity !== this.player && entity instanceof PlayerEntity && !entity.creative && !entity.spectator) {
                    if (entity.renderer) {
                        entity.renderer.hurtTimestamp = performance.now();
                    }
                    entity.damageEntity(2, this.player.username);
                    if (!this.isSingleplayer()) {
                        const nm = this.playerController.getNetworkHandler().getNetworkManager();
                        if (nm) nm.sendJson({ type: 'attack', target: entity.id, damage: 2, attacker: this.player.username });
                    }
                    this.player.swingArm();
                    return;
                }

                if (hitResult != null) {
                    if (this.player.creative) {
                        // Get previous block
                        let typeId = this.world.getBlockAt(hitResult.x, hitResult.y, hitResult.z);
                        let block = Block.getById(typeId);
                        if (block.onMouseButton(this.world, hitResult.x, hitResult.y, hitResult.z, button)) return;

                        if (typeId !== 0) {
                            let soundName = block.getSound().getBreakSound();

                            // Play sound
                            this.soundManager.playSound(soundName, this.player.x + 0.5, this.player.y + 1.6, this.player.z + 0.5, 1.0, 1.0);

                            // Get block ID before destroying
                            let blockId = this.world.getBlockAt(hitResult.x, hitResult.y, hitResult.z);
                            let droppedBlock = Block.getById(blockId).getDrop(this.world, hitResult.x, hitResult.y, hitResult.z)

                            this.particleRenderer.spawnBlockBreakParticle(this.world, hitResult.x, hitResult.y, hitResult.z);

                            // Destroy block
                            this.world.setBlockAt(hitResult.x, hitResult.y, hitResult.z, 0);

                            // Drop item (add to player inventory)
                            if (!this.player.creative && droppedBlock && droppedBlock.length === 2) {
                                this.player.inventory.addItem(droppedBlock[0], droppedBlock[1]);
                            }

                            // Send block digging packet in multiplayer
                            if (!this.isSingleplayer()) {
                                let blockPos = new BlockPosition(hitResult.x, hitResult.y, hitResult.z);
                                let face = 0; // Default face
                                this.playerController.sendBlockDiggingPacket(2, blockPos, face);
                            }
                        }
                    }
                }
                this.player.swingArm();
            }

            // Pick block
            if (button === 1 && this.player.creative) {
                if (hitResult != null) {
                    let typeId = this.world.getBlockAt(hitResult.x, hitResult.y, hitResult.z);
                    if (typeId !== 0) {
                        // Switch to slot if item is already in hotbar
                        for (let i = 0; i < 9; i++) {
                            let itemStack = this.player.inventory.getItemInSlot(i);
                            if (!itemStack.isEmpty() && itemStack.getType() === typeId) {
                                this.player.inventory.selectedSlotIndex = i;
                                return;
                            }
                        }

                        // Set item in hotbar
                        this.player.inventory.setItemInSelectedSlot(typeId);
                    }
                }
            }

            // Place block
            if (button === 2) {
                if (hitResult != null) {
                    let x = hitResult.x + hitResult.face.x;
                    let y = hitResult.y + hitResult.face.y;
                    let z = hitResult.z + hitResult.face.z;

                    let blockCheck = Block.getById(this.world.getBlockAt(hitResult.x, hitResult.y, hitResult.z));
                    if (blockCheck.onMouseButton(this.world, hitResult.x, hitResult.y, hitResult.z, button)) return;

                    let placedBoundingBox = new BoundingBox(x, y, z, x + 1, y + 1, z + 1);

                    // Don't place blocks if the player is standing there
                    if (!placedBoundingBox.intersects(this.player.boundingBox)) {
                        let typeId = this.player.inventory.getItemInSelectedSlot();
                        typeId = typeId.getType() || 0;

                        // Get previous block
                        let prevTypeId = this.world.getBlockAt(x, y, z);
                        let prevBlock = Block.getById(prevTypeId);
                        let isReplaceable = (prevBlock && prevBlock.isReplaceable(this.world, x, y, z)) || prevTypeId === 0;

                        if (typeId !== 0 && isReplaceable) {
                            // Calculate block data for rotation
                            let blockData = 0;
                            let block = Block.getById(typeId);

                            // Set rotation data for logs based on placement face
                            if (block.constructor.name === 'BlockLog') {
                                if (hitResult.face.isXAxis()) {
                                    blockData = 1; // East-west
                                } else if (hitResult.face.isZAxis()) {
                                    blockData = 2; // North-south
                                }
                            }

                            // Slab top/bottom based on placement face
                            if (block.constructor.name === 'BlockSlab') {
                                if (hitResult.face.y === -1) {
                                    blockData = 1; // Top slab
                                }
                            }

                            // Chest/furnace facing based on player yaw
                            if (block.constructor.name === 'BlockChest' || block.constructor.name === 'BlockFurnace') {
                                let dirIndex = Math.floor((this.player.rotationYaw * 4 / 360) + 0.5) & 3;
                                blockData = [2, 5, 3, 4][dirIndex]; // 2=N, 3=S, 4=W, 5=E — front faces player
                            }

                            // Place block
                            this.world.setBlockAt(x, y, z, typeId, blockData);

                            // Remove from inventory in survival mode
                            if (!this.player.creative) {
                                this.player.inventory.removeItem(typeId, 1, this.player.inventory.selectedSlotIndex);
                            }

                            // Swing player arm
                            this.player.swingArm();

                            // Handle block abilities
                            block.onBlockPlaced(this.world, x, y, z, hitResult.face);

                            // Play sound
                            let sound = block.getSound();
                            let soundName = sound.getStepSound();
                            this.soundManager.playSound(
                                soundName,
                                hitResult.x + 0.5,
                                hitResult.y + 0.5,
                                hitResult.z + 0.5,
                                1.0,
                                sound.getPitch() * 0.8
                            );

                            // Send block placement packet in multiplayer
                            if (!this.isSingleplayer()) {
                                let blockPos = new BlockPosition(hitResult.x, hitResult.y, hitResult.z);
                                let direction = this.getFaceValue(hitResult.face);
                                let heldItem = { id: typeId };
                                this.playerController.sendBlockPlacementPacket(blockPos, direction, heldItem);
                            }
                        }
                    }
                }
            }

            // Rebuild multiple chunk sections
            this.worldRenderer.flushRebuild = true;
        }
    }

    onMouseScroll(delta) {
        if (this.isInGame()) {
            this.player.inventory.shiftSelectedSlot(delta);
        }
    }

    isPaused() {
        if (this.currentScreen) {
            // In multiplayer, menus never pause the game
            if (!this.isSingleplayer()) {
                return false;
            }
            if (this.currentScreen.pauseGame === false) {
                return false;
            }
            if (this.currentScreen.pauseGame === true) {
                return true;
            }
        }
        return !this.hasInGameFocus() && this.loadingScreen === null && this.isSingleplayer();
    }

    setSession(session, save = false) {
        this.session = session;

        const profile = session && session.getProfile ? session.getProfile() : null;
        if (profile && profile.username) {
            this.settings.username = profile.username;
        } else if (!session) {
            this.settings.username = "";
        }

        // Save session
        if (save) {
            this.settings.session = session ? session.toJson() : null;
            this.settings.save();
        }
    }

    updateAccessToken(token) {
        this.session.setAccessToken(token);
        this.setSession(this.session, true);
    }

    getSession() {
        return this.session;
    }

    isSingleplayer() {
        return this.isInGame() && !(this.playerController instanceof PlayerControllerMultiplayer);
    }

    stop() {
        if (this.currentScreen !== null) {
            this.currentScreen.onClose();
        }
        this.running = false;
        this.worldRenderer.reset();
        this.itemRenderer.reset();
        this.screenRenderer.reset();
        this.window.close();
    }

    getThreeTexture(id) {
        if (!(id in this.resources)) {
            console.error("Texture not found: " + id);
            return;
        }

        let image = this.resources[id];
        let canvas = document.createElement('canvas');
        let context = canvas.getContext("2d");
        canvas.width = image.width;
        canvas.height = image.height;
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, image.width, image.height);
        return new THREE.CanvasTexture(canvas);
    }

    rayTraceEntity(reach, partialTicks) {
        let from = this.player.getPositionEyes(partialTicks);
        let look = this.player.getLook(partialTicks);
        let to = new Vector3(
            from.x + look.x * reach,
            from.y + look.y * reach,
            from.z + look.z * reach
        );

        let closest = null;
        let closestDist = reach;

        for (let entity of this.world.entities) {
            if (entity === this.player || !entity.boundingBox) continue;

            let bb = entity.boundingBox.grow(0.1, 0.1, 0.1);
            let hit = this.intersectRayAABB(from, to, bb);
            if (hit !== null) {
                let dist = from.distanceTo(hit);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = entity;
                }
            }
        }

        return closest;
    }

    intersectRayAABB(from, to, bb) {
        let dir = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);

        let tMin = -Infinity;
        let tMax = Infinity;

        if (dir.x !== 0) {
            let tx1 = (bb.minX - from.x) / dir.x;
            let tx2 = (bb.maxX - from.x) / dir.x;
            tMin = Math.max(tMin, Math.min(tx1, tx2));
            tMax = Math.min(tMax, Math.max(tx1, tx2));
        } else if (from.x < bb.minX || from.x > bb.maxX) {
            return null;
        }

        if (dir.y !== 0) {
            let ty1 = (bb.minY - from.y) / dir.y;
            let ty2 = (bb.maxY - from.y) / dir.y;
            tMin = Math.max(tMin, Math.min(ty1, ty2));
            tMax = Math.min(tMax, Math.max(ty1, ty2));
        } else if (from.y < bb.minY || from.y > bb.maxY) {
            return null;
        }

        if (dir.z !== 0) {
            let tz1 = (bb.minZ - from.z) / dir.z;
            let tz2 = (bb.maxZ - from.z) / dir.z;
            tMin = Math.max(tMin, Math.min(tz1, tz2));
            tMax = Math.min(tMax, Math.max(tz1, tz2));
        } else if (from.z < bb.minZ || from.z > bb.maxZ) {
            return null;
        }

        if (tMin > tMax || tMax < 0) return null;

        let t = tMin < 0 ? tMax : tMin;
        return new Vector3(from.x + dir.x * t, from.y + dir.y * t, from.z + dir.z * t);
    }

    getFaceValue(face) {
        // Minecraft protocol face values (version 47)
        // 0: Bottom (Y-), 1: Top (Y+), 2: North (Z-), 3: South (Z+), 4: West (X-), 5: East (X+)
        if (face.y === -1) return 0; // Bottom
        if (face.y === 1) return 1;  // Top
        if (face.z === -1) return 2; // North
        if (face.z === 1) return 3;  // South
        if (face.x === -1) return 4; // West
        if (face.x === 1) return 5;  // East
        return 0; // Default
    }
}