import * as THREE from "../../../../../../../libraries/three.module.js";
import Block from "../block/Block.js";
import DummyWorld from "./DummyWorld.js";

export default class Sublevel {
    constructor(minecraft, x, y, z) {
        this.minecraft = minecraft;
        this.x = x;
        this.y = y;
        this.z = z;

        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;

        this.group = new THREE.Object3D();
        this.world = new DummyWorld(this.minecraft, this.group, this);
        this.blocks = [];

        this.updateGroup();
    }

    renderBlocks() {
        this.blocks.forEach((block) => {
            let x = block[0];
            let y = block[1];
            let z = block[2];
            let typeId = block[3];

            this.minecraft.worldRenderer.blockRenderer.renderBlock(this.world, Block.getById(typeId), false, x, y, z);
        })
        let tessellator = this.minecraft.worldRenderer.blockRenderer.tessellator;

        if (tessellator.addedVertices > 0) {
            let mesh = tessellator.draw(this.group, true);
        }
    }

    updateGroup() {
        this.renderBlocks();
        this.group.position.x = this.x;
        this.group.position.y = this.y;
        this.group.position.z = this.z;
        this.group.rotation.x = this.rotationX;
        this.group.rotation.y = this.rotationY;
        this.group.rotation.z = this.rotationZ;
    }

    setRotation(x, y, z) {
        this.rotationX = x;
        this.rotationY = y;
        this.rotationZ = z;
        this.updateGroup();
    }

    setPosition(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.updateGroup();
    }

    //position
    setPositionX(pos) {
        this.x = pos;
        this.updateGroup();
    }

    setPositionY(pos) {
        this.y = pos;
        this.updateGroup();
    }

    setPositionZ(pos) {
        this.z = pos;
        this.updateGroup();
    }

    addPositionX(pos) {
        this.x += pos;
        this.updateGroup();
    }

    addPositionY(pos) {
        this.y += pos;
        this.updateGroup();
    }

    addPositionZ(pos) {
        this.z += pos;
        this.updateGroup();
    }

    //rotation
    setRotationX(pos) {
        this.rotationX = pos;
        this.updateGroup();
    }

    setRotationY(pos) {
        this.rotationY = pos;
        this.updateGroup();
    }

    setRotationZ(pos) {
        this.rotationZ = pos;
        this.updateGroup();
    }

    addRotationX(pos) {
        this.rotationX += pos;
        this.updateGroup();
    }

    addRotationY(pos) {
        this.rotationY += pos;
        this.updateGroup();
    }

    addRotationZ(pos) {
        this.rotationZ += pos;
        this.updateGroup();
    }
}