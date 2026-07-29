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
import ItemTool from "./world/block/type/ItemTool.js";
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
import Chunk from "./world/Chunk.js";
import World from "./world/World.js";
import PlayerController from "./network/controller/PlayerController.js";
import Long from "../../../../../libraries/long.js";
import generateUsername from "./UsernameGenerator.js";
import Vector3 from "../util/Vector3.js";
import MathHelper from "../util/MathHelper.js";
import InventoryBasic from "./inventory/inventory/InventoryBasic.js";
import BlockPosition from "../util/BlockPosition.js";
import GuiContainerSurvival from "./gui/screens/container/GuiContainerSurvival.js";
import CraftingRegistry from "./crafting/CraftingRegistry.js";
import SmeltingRegistry from "./smelting/SmeltingRegistry.js";
import GuiPrelaunch from "./gui/screens/GuiPrelaunch.js";
import GuiFunctions from "./gui/screens/GuiFunctions.js";
import ItemEntity from "./entity/ItemEntity.js";
import PlayerEntity from "./entity/PlayerEntity.js";
import { Version } from "../../../../resources/version.js";

export default class Minecraft {

    static VERSION = Version.VERSION;
    static TIMESTAMP = Version.TIMESTAMP;
    static PATCHWORK_VERSION = Version.PATCHWORK_VERSION;
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
        this.currentWorldKey = null;
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
        SmeltingRegistry.reset();

        // Tools are registered in BlockRegistry.create() alongside blocks and items

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

        // Create filesystem for texture packs
        this.filesystem = new FileSystem('TexturePackDB', 'texture_packs');

        // If in prelaunch mode; display the menu for it instead
        if (window.isPreLaunch) {
            console.log("Prelaunch mode; game won't start until menu is exited.");
            this.displayScreen(new GuiPrelaunch(this));
        } else {
            this.displayScreen(new GuiMainMenu());
        }

        // Create Filesystem
        this.fs = new FileSystem();

        // World save state
        this.lastSaveTime = Date.now();
        this.saveInterval = 30000;

        // Create various player properties
        this.miningTimer = 0;
        this.maxMiningTicks = 30;
        this.lastBlockPos = null;
        this.isMining = false;

        // Loading screen timeout tracking
        this.lastChunkCount = 0;
        this.lastChunkArrivalTime = 0;

        // Initialize
        this.init();

        // Mixins
        this.addMixinHandlers();
    }

    addMixinHandlers() {
        // src/js/net/minecraft/client/Minecraft.js

        // src/js/net/minecraft/client/world/World.js
        Mixin.registerFunction('game:teleportEntityPos', (eid, x, y, z) => {
            if (this.world && this.world.getEntityById(eid)) {
                this.world.getEntityById(eid).x = x;
                this.world.getEntityById(eid).y = y;
                this.world.getEntityById(eid).z = z;
                return true;
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getEntityPos', (eid) => {
            if (this.world && this.world.getEntityById(eid)) {
                return {
                    x: this.world.getEntityById(eid).x,
                    y: this.world.getEntityById(eid).y,
                    z: this.world.getEntityById(eid).z
                };
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:setBlockAt', (x, y, z, id) => {
            if (this.world) {
                this.world.setBlockAt(x, y, z, id);
                return true;
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getBlockAt', (x, y, z) => {
            if (this.world) {
                return this.world.getBlockAt(x, y, z);
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:setBlockDataAt', (x, y, z, data) => {
            if (this.world) {
                this.world.setBlockDataAt(x, y, z, data);
                return true;
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getBlockDataAt', (x, y, z) => {
            if (this.world) {
                return this.world.getBlockDataAt(x, y, z);
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getWorld', () => {
            if (this.world) {
                return this.world;
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getGame', () => {
            if (this) {
                return this;
            } else {
                return undefined;
            }
        });

        Mixin.registerFunction('game:getPlayer', () => {
            if (this.player) {
                return this.player;
            } else {
                return undefined;
            }
        });
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

    async loadWorld(world) {
        this.miningTimer = 0;
        this.lastBlockPos = null;
        this.musicManager.stopMusic();

        if (world === null) {
            // Save world before quitting
            if (this.world !== null && this.isSingleplayer()) {
                await this.saveWorld();
            }

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

            // Reset chunk timeout tracking for the new world
            this.lastChunkCount = 0;
            this.lastChunkArrivalTime = 0;

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

            // Reload texture atlas with selected pack if set
            if (this.settings.selectedTexturePack && this.worldRenderer.textureAtlas) {
                this.worldRenderer.textureAtlas.texturePath = `texture_packs/${this.settings.selectedTexturePack}/`;
                await this.worldRenderer.textureAtlas.loadTextures();
            }

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
        // Load saved chunk data from IndexedDB before generating new chunks
        if (this.isSingleplayer()) {
            await this.loadWorldSave(world, this.currentWorldKey);
        }

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

        world.spawn.y = world.getHeightAt(world.spawn.x, world.spawn.z) + 1;
        this.player.respawn();

        if (this.loadingScreen !== null) {
            this.loadingScreen = null;
            this.displayScreen(null);
        }

        this.musicManager.playMusic('game');
    }

    _getWorldDB() {
        if (this._worldDB) return Promise.resolve(this._worldDB);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('WorldSaveDB', 1);
            request.onupgradeneeded = (event) => {
                event.target.result.createObjectStore('saves', { keyPath: 'key' });
            };
            request.onsuccess = (event) => {
                this._worldDB = event.target.result;
                resolve(this._worldDB);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async _migrateOldSave() {
        const db = await this._getWorldDB();
        const tx = db.transaction('saves', 'readwrite');
        const store = tx.objectStore('saves');

        const indexGet = await new Promise(r => {
            const req = store.get('world_index');
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(null);
        });
        if (indexGet) return;

        const old = await new Promise(r => {
            const req = store.get('current_world');
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(null);
        });
        if (!old) return;

        const data = old.data;
        const worldKey = 'w_' + Date.now();
        data.name = data.name || 'My World';

        await new Promise((resolve, reject) => {
            store.put({ key: worldKey, data, timestamp: Date.now() });
            const indexEntry = {
                key: worldKey,
                name: data.name,
                seedLow: data.seedLow || 0,
                seedHigh: data.seedHigh || 0,
                worldType: data.worldType || 'normal',
                gameMode: 'survival',
                lastPlayed: Date.now(),
                time: data.time || 0,
                spawnX: data.spawnX || 0,
                spawnY: data.spawnY || 0,
                spawnZ: data.spawnZ || 0,
            };
            store.put({ key: 'world_index', data: [indexEntry], timestamp: Date.now() });
            store.delete('current_world');
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async _loadWorldIndex() {
        const db = await this._getWorldDB();

        // Check if index exists; if not, try migrating old save
        const checkTx = db.transaction('saves', 'readonly');
        const checkGet = await new Promise(r => {
            const req = checkTx.objectStore('saves').get('world_index');
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(null);
        });

        if (!checkGet) {
            await this._migrateOldSave();
        }

        return new Promise((resolve) => {
            const tx = db.transaction('saves', 'readonly');
            const get = tx.objectStore('saves').get('world_index');
            get.onsuccess = () => resolve(get.result ? get.result.data : []);
            get.onerror = () => resolve([]);
        });
    }

    async _saveWorldIndex(index) {
        const db = await this._getWorldDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('saves', 'readwrite');
            tx.objectStore('saves').put({ key: 'world_index', data: index, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async _saveWorldToDB(worldKey, saveData) {
        const db = await this._getWorldDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('saves', 'readwrite');
            tx.objectStore('saves').put({ key: worldKey, data: saveData, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async _loadWorldFromDB(worldKey) {
        const db = await this._getWorldDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('saves', 'readonly');
            const get = tx.objectStore('saves').get(worldKey);
            get.onsuccess = () => resolve(get.result ? get.result.data : null);
            get.onerror = (e) => reject(e.target.error);
        });
    }

    async hasSaveData() {
        const index = await this._loadWorldIndex();
        return index.length > 0;
    }

    async getWorldList() {
        return this._loadWorldIndex();
    }

    async createNewWorld(name, seedLong, worldType, gameMode) {
        const worldKey = 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        this.currentWorldKey = worldKey;

        let world = new World(this);
        let provider = new ChunkProviderGenerateWorker(world, seedLong, worldType);
        world.setChunkProvider(provider);

        // Add to world index
        const index = await this._loadWorldIndex();
        index.push({
            key: worldKey,
            name: name,
            seedLow: seedLong.low,
            seedHigh: seedLong.high,
            worldType: worldType,
            gameMode: gameMode || 'survival',
            lastPlayed: Date.now(),
            time: 0,
            spawnX: 0,
            spawnY: 0,
            spawnZ: 0,
        });
        await this._saveWorldIndex(index);

        this.playerController = new PlayerController(this);
        await this.loadWorld(world);
        this.ingameOverlay.chatOverlay.clearChat();

        return world;
    }

    async saveWorld() {
        if (!this.world || !this.isSingleplayer() || !this.currentWorldKey) return;

        const provider = this.world.getChunkProvider();
        const chunks = provider.getChunks();
        const modifiedData = {};
        const dirtySections = [];

        for (const [index, chunk] of chunks) {
            if (chunk.hasDirtySections()) {
                modifiedData[index] = chunk.serialize();
                dirtySections.push(chunk.sections);
            }
        }

        try {
            const seed = this.world.getSeed();
            const saveData = {
                name: '',
                seedLow: seed && typeof seed === 'object' ? seed.low : 0,
                seedHigh: seed && typeof seed === 'object' ? seed.high : 0,
                worldType: provider.worldType || 'normal',
                spawnX: this.world.spawn.x,
                spawnY: this.world.spawn.y,
                spawnZ: this.world.spawn.z,
                time: this.world.time,
                chunks: modifiedData
            };

            if (Object.keys(modifiedData).length > 0) {
                for (const sections of dirtySections) {
                    for (const section of sections) {
                        section.isDirty = false;
                    }
                }
            }

            if (this.world.blockInventories && this.world.blockInventories.size > 0) {
                const inventories = [];
                for (const [key, inv] of this.world.blockInventories) {
                    const state = inv.toNetworkState();
                    for (const prop of Object.keys(inv)) {
                        if (prop !== 'items' && typeof inv[prop] !== 'function') {
                            state[prop] = inv[prop];
                        }
                    }
                    inventories.push({ key, state });
                }
                saveData.blockInventories = inventories;
            }

            if (this.player && this.player.inventory) {
                saveData.playerInventory = this.player.inventory.toNetworkState();
            }

            if (this.player) {
                saveData.playerPos = { x: this.player.x, y: this.player.y, z: this.player.z };
                saveData.playerRot = { yaw: this.player.rotationYaw, pitch: this.player.rotationPitch };
                saveData.playerHealth = this.player.health;
                saveData.playerGameMode = {
                    creative: this.player.creative,
                    spectator: this.player.spectator,
                    flying: this.player.flying,
                };
            }

            // Save dropped items
            const itemEntities = [];
            if (this.world.entities) {
                for (const entity of this.world.entities) {
                    if (entity.constructor.name === 'ItemEntity') {
                        itemEntities.push({
                            blockId: entity.getBlockId(),
                            x: entity.x,
                            y: entity.y,
                            z: entity.z,
                            motionX: entity.motionX,
                            motionY: entity.motionY,
                            motionZ: entity.motionZ,
                        });
                    }
                }
            }
            if (itemEntities.length > 0) {
                saveData.itemEntities = itemEntities;
            }

            await this._saveWorldToDB(this.currentWorldKey, saveData);

            // Update world index metadata
            const index = await this._loadWorldIndex();
            const entry = index.find(e => e.key === this.currentWorldKey);
            if (entry) {
                if (!entry.name && saveData.name) entry.name = saveData.name;
                entry.lastPlayed = Date.now();
                entry.time = this.world.time;
                entry.spawnX = this.world.spawn.x;
                entry.spawnY = this.world.spawn.y;
                entry.spawnZ = this.world.spawn.z;
                if (this.player) {
                    entry.gameMode = this.player.creative ? 'creative' : this.player.spectator ? 'spectator' : 'survival';
                }
                await this._saveWorldIndex(index);
            }
        } catch (err) {
            console.error('Failed to save world:', err);
        }
    }

    async loadWorldSave(world, worldKey) {
        if (!this.isSingleplayer()) return;

        try {
            const saveData = await this._loadWorldFromDB(worldKey);
            if (!saveData) return;
            const provider = world.getChunkProvider();

            if (saveData.seedLow !== undefined) {
                const currentSeed = world.getSeed();
                if (currentSeed && typeof currentSeed === 'object') {
                    if (currentSeed.low !== saveData.seedLow || currentSeed.high !== saveData.seedHigh) {
                        return;
                    }
                }
            }

            for (const key in saveData.chunks) {
                const chunkData = saveData.chunks[key];
                const chunk = Chunk.deserialize(world, chunkData);
                provider.getChunks().set(parseInt(key), chunk);
                world.group.add(chunk.group);
            }

            if (saveData.spawnX !== undefined) {
                world.spawn.x = saveData.spawnX;
                world.spawn.y = saveData.spawnY;
                world.spawn.z = saveData.spawnZ;
            }
            if (saveData.time !== undefined) {
                world.time = saveData.time;
            }

            if (saveData.blockInventories) {
                if (!world.blockInventories) {
                    world.blockInventories = new Map();
                }
                for (const entry of saveData.blockInventories) {
                    const inv = new InventoryBasic(entry.state.size || 1);
                    inv.applyNetworkState(entry.state);
                    world.blockInventories.set(entry.key, inv);
                }
            }

            if (saveData.playerInventory && this.player && this.player.inventory) {
                this.player.inventory.applyNetworkState(saveData.playerInventory);
            }
        } catch (err) {
            console.error('Failed to load world save:', err);
        }
    }

    async loadSavedWorld(worldKey) {
        const saveData = await this._loadWorldFromDB(worldKey);
        if (!saveData) return false;

        this.currentWorldKey = worldKey;

        let seedLong;
        if (saveData.seedLow !== undefined) {
            seedLong = new Long(saveData.seedLow, saveData.seedHigh);
        } else {
            seedLong = new Long(0, 0);
        }

        const worldType = saveData.worldType || 'normal';

        let world = new World(this);
        let provider = new ChunkProviderGenerateWorker(world, seedLong, worldType);
        world.setChunkProvider(provider);

        this.playerController = new PlayerController(this);
        await this.loadWorld(world);
        this.ingameOverlay.chatOverlay.clearChat();

        const index = await this._loadWorldIndex();
        const entry = index.find(e => e.key === worldKey);
        if (entry) {
            if (this.player) {
                this.player.creative = (entry.gameMode === 'creative');
                this.player.spectator = (entry.gameMode === 'spectator');
            }
        }

        if (saveData.playerPos && this.player) {
            this.player.setPositionAndRotation(
                saveData.playerPos.x, saveData.playerPos.y, saveData.playerPos.z,
                saveData.playerRot ? saveData.playerRot.yaw : 0,
                saveData.playerRot ? saveData.playerRot.pitch : 0
            );
        }

        if (saveData.playerHealth !== undefined && this.player) {
            this.player.health = saveData.playerHealth;
            this.player.isDead = this.player.health <= 0;
        }

        if (saveData.playerGameMode && this.player) {
            this.player.creative = saveData.playerGameMode.creative;
            this.player.spectator = saveData.playerGameMode.spectator;
            this.player.flying = saveData.playerGameMode.flying;
        }

        if (saveData.itemEntities && this.world && this.world.entities) {
            for (const itemData of saveData.itemEntities) {
                const item = new ItemEntity(this, this.world, itemData.blockId, itemData.x, itemData.y, itemData.z);
                item.motionX = itemData.motionX || 0;
                item.motionY = itemData.motionY || 0;
                item.motionZ = itemData.motionZ || 0;
                item.tickCount = 0;
                this.world.addEntity(item);
            }
        }

        return true;
    }

    async deleteWorld(worldKey) {
        const db = await this._getWorldDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('saves', 'readwrite');
            tx.objectStore('saves').delete(worldKey);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });

        const index = await this._loadWorldIndex();
        const filtered = index.filter(e => e.key !== worldKey);
        await this._saveWorldIndex(filtered);
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

            if (this.player) {
                this.world.cloudTexture.offset.x =  this.player.x * 0.0001 + this.world.cloudOffset;
                this.world.cloudTexture.offset.y = -this.player.z * 0.0001;
                
                this.world.clouds.position.x = this.player.x; // / 2 * 1.5;
                this.world.clouds.position.z = this.player.z; // / 2 * 1.5;
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

    isElectron() {
        // Renderer process
        if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
            return true;
        }

        // Main process
        if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
            return true;
        }

        // Renderer process with nodeIntegration disabled
        if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
            return true;
        }

        return false;
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

        if (this.isElectron()) {
            document.title = "Breakmine" + " (" + Version.VERSION + ", " + Version.TIMESTAMP + ")";
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

            // Track chunk arrival for timeout detection
            if (loadedChunks !== this.lastChunkCount) {
                this.lastChunkCount = loadedChunks;
                this.lastChunkArrivalTime = Date.now();
            }

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

            // Finish loading when enough chunks are loaded, or fall back after a timeout
            // to prevent getting stuck on slow connections
            let timeoutElapsed = this.lastChunkArrivalTime > 0
                && Date.now() - this.lastChunkArrivalTime > 5000
                && loadedChunks >= 9;

            if (progress >= 0.99 || timeoutElapsed) {
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

        // Auto-save world every 30 seconds
        if (this.isInGame() && this.isSingleplayer() && this.loadingScreen === null) {
            if (Date.now() - this.lastSaveTime > this.saveInterval) {
                this.lastSaveTime = Date.now();
                this.saveWorld();
            }
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

            this.soundManager.playSoundMono(soundName, 0.5, 1.0);
        }

        let block = Block.getById(typeId);
        let requiredTicks = Math.ceil(block.getHardness() * 30);

        let heldItem = this.player.inventory.getItemInSelectedSlot()
        let heldTypeId = heldItem ? heldItem.getType() : null
        let heldBlock = heldTypeId ? Block.getById(heldTypeId) : null
        let tool = heldBlock instanceof ItemTool ? heldBlock : null

        let minLevel = block.minimumToolLevel()
        if (minLevel) {
            let toolMaterial = tool ? tool.material : null
            if (!toolMaterial || ItemTool.materials.indexOf(toolMaterial) < ItemTool.materials.indexOf(minLevel)) {
                requiredTicks *= 5
            }
        }

        let preferredType = block.getPreferredToolType()
        if (tool && (!preferredType || tool.toolType === preferredType)) {
            let eff = tool.efficiency() || 1
            requiredTicks = Math.ceil(requiredTicks / eff)
        } else {
            requiredTicks = Math.ceil(requiredTicks * Block.handHardnessMultiplier)
        }

        if (this.miningTimer >= requiredTicks) {
            this.breakTargetBlock(hitResult, typeId);
            this.miningTimer = 0;
            this.lastBlockPos = null;
        }
    }

    breakTargetBlock(hitResult, typeId) {
        let block = Block.getById(typeId);
        let droppedBlock = [0, 0];

        let heldItem = this.player.inventory.getItemInSelectedSlot()
        let heldTypeId = heldItem ? heldItem.getType() : null
        let heldBlock = heldTypeId ? Block.getById(heldTypeId) : null
        let tool = heldBlock instanceof ItemTool ? heldBlock : null

        let minLevel = block.minimumToolLevel()
        if (!minLevel) {
            droppedBlock = block.getDrop(this.world, hitResult.x, hitResult.y, hitResult.z);
        } else if (tool) {
            let toolMaterial = tool.material
            if (ItemTool.materials.indexOf(toolMaterial) >= ItemTool.materials.indexOf(minLevel)) {
                droppedBlock = block.getDrop(this.world, hitResult.x, hitResult.y, hitResult.z);
            }
        }

        let soundName = block.getSound().getBreakSound();

        this.soundManager.playSoundMono(soundName, 1.0, 1.0);

        this.particleRenderer.spawnBlockBreakParticle(this.world, hitResult.x, hitResult.y, hitResult.z);

        // Play drop sound
        this.soundManager.playSoundMono('random.pop', 1.0, 1.0);

        this.world.setBlockAt(hitResult.x, hitResult.y, hitResult.z, 0);
        for (let index = 0; index < droppedBlock[1]; index++) {
            if (this.isSingleplayer()) {
                // Singleplayer: create entity locally
                this.world.addEntity(new ItemEntity(this, this.world, droppedBlock[0], hitResult.x, hitResult.y, hitResult.z));
            } else {
                // Multiplayer: tell server to spawn item for all players
                this.playerController.getNetworkHandler().sendPacket(new ClientDropItemPacket(droppedBlock[0]));
            }
        }
        this.player.swingArm();

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

        // Open chat commands
        if (button === this.settings.keyOpenCommands) {
            const chatScreen = new GuiChat(this);
            chatScreen.inputField.setText("/");
            this.displayScreen(chatScreen);
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

        // Toggle GUI visibility (F1) - only in-game, not in menus
        if (button === "F1") {
            if (this.currentScreen === null && this.isInGame()) {
                GuiFunctions.toggleGui();
                if (GuiFunctions.isGuiHidden() && this.itemRenderer) {
                    this.itemRenderer.destroy("hotbar");
                }
            }
        }

        // Take screenshot (F2)
        if (button === "F2") {
            GuiFunctions.takeScreenshot(this.window.canvas);
        }

        // Drop held item
        if (button === "KeyQ") {
            if (this.player.spectator) return;
            if (this.player.inventory.getItemInSelectedSlot() !== 0 && this.player.inventory.getItemInSelectedSlot() !== null && this.player.inventory.getItemInSelectedSlot()?.isEmpty() === false) {
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
                    if (this.player.attackCooldown > 0) {
                        return;
                    }
                    if (entity.renderer) {
                        entity.renderer.hurtTimestamp = performance.now();
                    }
                    let damage = this.getAttackDamage();
                    entity.damageEntity(damage, this.player.username);
                    this.player.attackCooldown = 30;
                    if (!this.isSingleplayer()) {
                        const nm = this.playerController.getNetworkHandler().getNetworkManager();
                        if (nm) nm.sendJson({ type: 'attack', target: entity.id, damage: damage, attacker: this.player.username });
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

            // Use item / eat
            if (button === 2) {
                let heldItem = this.player.inventory.getItemInSelectedSlot();

                if (heldItem && !heldItem.isEmpty() && Block.getById(heldItem.getType())?.isItem()) {
                    let x = undefined;
                    let y = undefined;
                    let z = undefined;
                    if (hitResult != null) {
                        x = hitResult.x + hitResult.face.x;
                        y = hitResult.y + hitResult.face.y;
                        z = hitResult.z + hitResult.face.z;
                    }
                    Block.getById(heldItem.getType()).onUse(this.world, x, y, z, heldItem);
                    return;
                }

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

    getAttackDamage() {
        let heldItem = this.player.inventory.getItemInSelectedSlot();
        if (heldItem.isEmpty()) {
            return 1;
        }
        let item = Block.getById(heldItem.getType());
        if (item && item.isTool && item.toolType) {
            let materialLevel = ItemTool.materials.indexOf(item.material);
            if (item.toolType === 'sword') {
                return 1 + materialLevel;
            }
            if (item.toolType === 'axe') {
                return 0.5 + materialLevel;
            }
        }
        return 1;
    }
}