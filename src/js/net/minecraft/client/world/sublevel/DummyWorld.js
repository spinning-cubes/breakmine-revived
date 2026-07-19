import ChunkSection from "../ChunkSection.js";
import Vector3 from "../../../util/Vector3.js";
import * as THREE from "../../../../../../../libraries/three.module.js";

export default class DummyWorld {
    static TOTAL_HEIGHT = ChunkSection.SIZE * 8;
    
    constructor(minecraft, group, sublevel) {
        this.minecraft = minecraft;

        this.entities = [];
        this.sublevel = sublevel;

        this.group = group;
        this.group = new THREE.Object3D();
        this.group.matrixAutoUpdate = false;

        this.lightUpdateQueue = [];
        this.chunkProvider = null;

        this.time = 0;
        this.spawn = new Vector3(0, 0, 0);

        // Block tick system
        this.blockTickQueue = [];
        this.scheduledBlockTicks = new Map();

        // Store interval ID for cleanup
        this.lightUpdateInterval = null;
    }

    getBlockAt(x, y, z) {
        return this.sublevel.blocks.find((block) => block[0] === x && block[1] === y && block[2] === z);
    }

    setBlockAt(x, y, z, typeId) {
        let block = this.getBlockAt(x, y, z);
        if (block) {
            block[3] = typeId;
        } else {
            this.sublevel.blocks.push([x, y, z, typeId]);
        }
        this.sublevel.updateGroup();
    }

    getChunkAt(x, y, z) {
        return null;
    }

    getTotalLightAt(x, y, z) {
        return 15;
    }

    getBlockAtFace(x, y, z, face) {
        return this.getBlockAt(x + face.x, y + face.y, z + face.z);
    }
}