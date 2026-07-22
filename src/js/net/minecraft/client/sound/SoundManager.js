import Block from "../world/block/Block.js";
import * as THREE from "../../../../../../libraries/three.module.js";

export default class SoundManager {

    constructor() {
        this.audioLoader = new THREE.AudioLoader();
        this.audioListener = null;

        this.soundPool = {};

        // Preload click sound
        this.clickReady = false;
        this.clickAudio = new Audio('src/resources/sound/random/click.ogg');
        this.clickAudio.addEventListener('canplaythrough', () => {
            this.clickReady = true;
        }, { once: true });
    }

    create(worldRenderer) {
        this.scene = worldRenderer.scene;

        this.audioListener = new THREE.AudioListener();
        worldRenderer.camera.add(this.audioListener);

        // Resume audio context (browsers suspend it until user interaction)
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume();
        }

        // Load initial sound pool
        for (let i in Block.sounds) {
            let sound = Block.sounds[i];

            // Load sound types
            this.loadSoundPool(sound.getStepSound());
        }

        // Preload item pickup sound
        this.loadSoundPool("random.pop");
    }

    loadSoundPool(name) {
        let pool = [];
        let amount = 4;

        // Load all sounds into pool
        let path = name.replace(".", "/");
        for (let i = 0; i < amount; i++) {
            try {
                let sound = this.loadSound('src/resources/sound/' + path + (i + 1) + '.ogg');
                if (sound) {
                    pool.push(sound);
                }
            } catch (e) {
                console.warn('Skipping sound file:', path + (i + 1), e);
            }
        }

        // Fallback to unnumbered file if no numbered variants loaded
        if (pool.length === 0) {
            try {
                let sound = this.loadSound('src/resources/sound/' + path + '.ogg');
                if (sound) {
                    pool.push(sound);
                }
            } catch (e) {
                console.warn('Skipping sound file:', path, e);
            }
        }

        // Only register pool if we have valid sounds
        if (pool.length > 0) {
            this.soundPool[name] = pool;
        } else {
            console.warn('Failed to load any sounds for:', name);
        }
    }

    loadSound(path) {
        if (!this.isCreated()) {
            return;
        }

        // Create sound
        let sound = new THREE.PositionalAudio(this.audioListener);
        sound.setRefDistance(0.1);
        sound.setRolloffFactor(6);
        sound.setFilter(sound.context.createBiquadFilter());
        sound.setVolume(1.0);
        sound.hasBuffer = false;

        // Load sound with proper error handling
        try {
            this.audioLoader.load(path, buffer => {
                sound.setBuffer(buffer);
                sound.hasBuffer = true;
                this.scene.add(sound);
            }, progress => {
                // Progress callback (optional)
            }, error => {
                console.error('Failed to load sound:', path, error);
                sound.hasBuffer = false;
            });
        } catch (e) {
            console.error('Exception loading sound:', path, e);
            sound.hasBuffer = false;
        }

        return sound;
    }

    playSound(name, x, y, z, volume, pitch) {
        //console.log(name, x, y, z, volume, pitch);
        
        let pool = this.soundPool[name];

        if (typeof pool === "undefined") {
            // Load sound pool
            this.loadSoundPool(name);
            pool = this.soundPool[name];
        }

        if (pool && pool.length > 0) {
            // Play random sound in pool
            let sound = pool[Math.floor(Math.random() * pool.length)];
            if (typeof volume === "undefined" || typeof sound === "undefined") {
                return;
            }

            // Check if sound has loaded successfully
            if (!sound.hasBuffer) {
                return;
            }

            // Resume audio context if suspended
            if (sound.context.state === 'suspended') {
                sound.context.resume();
            }

            // Stop previous sound
            if (sound.isPlaying) {
                sound.stop();
            }

            // Update position
            sound.position.set(x, y, z);

            // Force panner position sync before playing (updateMatrixWorld skips when isPlaying is false)
            sound.updateMatrixWorld(true);
            let pos = new THREE.Vector3();
            pos.setFromMatrixPosition(sound.matrixWorld);
            sound.panner.positionX.setValueAtTime(pos.x, sound.context.currentTime);
            sound.panner.positionY.setValueAtTime(pos.y, sound.context.currentTime);
            sound.panner.positionZ.setValueAtTime(pos.z, sound.context.currentTime);

            // Update volume and pitch
            sound.setVolume(volume * 10);
            sound.filters[0].frequency.setValueAtTime(12000 * pitch, sound.context.currentTime);

            // Play sound
            sound.offset = 0;
            sound.play();
        }
    }

    isCreated() {
        return !(this.audioListener === null);
    }

    playGuiClick() {
        if (!this.clickReady) {
            return;
        }
        this.clickAudio.currentTime = 0;
        this.clickAudio.play();
    }

}