import Block from "../Block.js";

// Generate eye texture mapped to align with THREE.Mesh.lookAt() (+Z forward)
function createEyeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Sclera
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette / Shading
    const grad = ctx.createRadialGradient(256, 128, 50, 256, 128, 200);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(200, 180, 180, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Iris
    const irisX = 256, irisY = 128, irisRadius = 70;
    const irisGrad = ctx.createRadialGradient(irisX, irisY, 10, irisX, irisY, irisRadius);
    irisGrad.addColorStop(0, '#1e90ff');
    irisGrad.addColorStop(0.7, '#00008b');
    irisGrad.addColorStop(1, '#000040');

    ctx.beginPath();
    ctx.arc(irisX, irisY, irisRadius, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(irisX, irisY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#050505';
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(irisX - 20, irisY - 20, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.offset.x = 0.25;
    texture.needsUpdate = true;
    return texture;
}

const eyeTexture = createEyeTexture();
const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
const sphereMaterial = new THREE.MeshBasicMaterial({ map: eyeTexture });

function updateEyeRotation(mesh, target) {
    const px = target.x ?? target.position?.x ?? 0;
    const py = target.y ?? target.position?.y ?? 0;
    const pz = target.z ?? target.position?.z ?? 0;
    
    // Target player's eye level (y + 1.62)
    mesh.lookAt(px, py + 1.62, pz);
}

export default class BlockEyes extends Block {
    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Eyes";
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

    onBlockPlaced(world, x, y, z, face) {
        world.scheduleBlockTick(x, y, z, 1);
    }

    onBlockTick(world, x, y, z) {
        const key = `${x},${y},${z}`;
        const mesh = this.activeMeshes.get(key);
        if (mesh) {
            const player = world?.minecraft?.player || world?.player;
            if (player) {
                updateEyeRotation(mesh, player);
            }
        }

        world.scheduleBlockTick(x, y, z, 1);
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

        const player = world?.minecraft?.player || world?.player;
        if (player) {
            updateEyeRotation(mesh, player);
        }

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