import Block from "../Block.js";

// Generate sphere geometry and bake directional vertex shading directly into it
const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
const posAttr = sphereGeometry.attributes.position;
const normAttr = sphereGeometry.attributes.normal;
const colors = [];

// Fake light source direction (coming from top-right-front)
const lightDir = new THREE.Vector3(0.5, 1.0, 0.75).normalize();

for (let i = 0; i < posAttr.count; i++) {
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);

    // Calculate dot product for basic directional shading factor [0.25 to 1.0]
    const normal = new THREE.Vector3(nx, ny, nz);
    const dot = Math.max(0.25, normal.dot(lightDir));

    // Multiply base white (1.0, 1.0, 1.0) by the shading factor
    colors.push(dot, dot, dot);
}

sphereGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

// Basic material using baked vertex colors—no light emitters required
const sphereMaterial = new THREE.MeshBasicMaterial({ 
    vertexColors: true 
});

export default class BlockSphere extends Block {
    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Sphere";
        this.hardness = 3.5;
        this.noFaceCull = true;
        this.activeMeshes = new Map();
    }

    canCastAmbientOcclusion() {
        return false;
    }

    getAmbientOcclusion() {
        return false;
    }

    onRender(world, x, y, z, blockRenderer) {
        const key = `${x},${y},${z}`;

        if (this.activeMeshes.has(key)) {
            const oldMesh = this.activeMeshes.get(key);
            if (world && world.group) world.group.remove(oldMesh);
            this.activeMeshes.delete(key);
        }

        const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5);

        if (world && world.group) {
            world.group.add(mesh);
            this.activeMeshes.set(key, mesh);
        }

        return true; 
    }

    onBlockRemoved(world, x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.activeMeshes.has(key)) {
            const mesh = this.activeMeshes.get(key);
            if (world && world.group) {
                world.group.remove(mesh);
            }
            this.activeMeshes.delete(key);
        }
    }
}