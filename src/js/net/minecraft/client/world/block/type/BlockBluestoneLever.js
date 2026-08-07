import Block from "../Block.js";
import BoundingBox from "../../../../util/BoundingBox.js";
import EnumCreativeInventoryTab from "../../../gui/EnumCreativeInventoryTab.js";

export default class BlockBluestoneLever extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Bluestone Lever";
        this.hardness = 0.5;
        this.isPowerSource = true;
        this.lever = true;
        this.noFaceCull = true;
        this.inventoryTab = EnumCreativeInventoryTab.NOTLISTED;

        // Render a flat bluestone dust layer embedded in the lever's base so
        // wires can visually connect to it. renderLever draws this after the
        // body with cutout enabled (dust id 179 = BLUESTONE_LEVER_DUST).
        this.renderInside = [
            ["block", 179, new BoundingBox(0, 0, 0, 1, 1 / 16, 1)]
        ];
    }

    isPowered(world, x, y, z) {
        return ((world.getBlockDataAt(x, y, z) || 0) & 1) === 1;
    }

    getPower(world, x, y, z, neighborFace) {
        return this.isPowered(world, x, y, z) ? 15 : 0;
    }

    // Block data bits: bit 0 = powered, bits 1-3 = face the lever is mounted
    // on (0=floor, 1=ceiling, 2=north wall, 3=south wall, 4=west wall,
    // 5=east wall).
    static getMountedFace(data) {
        return ((data || 0) >> 1) & 7;
    }

    // The face the lever attaches to is the opposite of the face that was
    // clicked when placing it (placing against a block's top mounts the lever
    // on the floor of the block above it, etc.).
    static getMountedFaceFromClickedFace(face) {
        if (face.y === -1) return 1; // clicked bottom -> ceiling mount
        if (face.y === 1) return 0;  // clicked top -> floor mount
        if (face.z === -1) return 3; // clicked north -> south wall
        if (face.z === 1) return 2;  // clicked south -> north wall
        if (face.x === -1) return 5; // clicked west -> east wall
        if (face.x === 1) return 4;  // clicked east -> west wall
        return 0;
    }

    _scheduleNeighbors(world, x, y, z) {
        const neighbors = [
            [x + 1, y, z],
            [x - 1, y, z],
            [x, y, z + 1],
            [x, y, z - 1],
            [x, y - 1, z],
            [x, y + 1, z],
        ];
        for (const [nx, ny, nz] of neighbors) {
            world.scheduleBlockTick(nx, ny, nz, 1);
        }
    }

    onBlockAdded(world, x, y, z) {
        this._scheduleNeighbors(world, x, y, z);
    }

    onBlockRemoved(world, x, y, z) {
        this._scheduleNeighbors(world, x, y, z);
    }

    onBlockPlaced(world, x, y, z, face) {
        if (face == null) {
            return;
        }
        const data = world.getBlockDataAt(x, y, z) || 0;
        const faceData = BlockBluestoneLever.getMountedFaceFromClickedFace(face);
        world.setBlockDataAt(x, y, z, (data & 1) | (faceData << 1));
    }

    onMouseButton(world, x, y, z, button) {
        if (button === 2) {
            const data = world.getBlockDataAt(x, y, z) || 0;
            world.setBlockDataAt(x, y, z, (data & ~1) | (1 - (data & 1)));
            this._scheduleNeighbors(world, x, y, z);
            world.notifyNeighborBlockChange(x, y, z);
            world.minecraft?.player?.swingArm?.();
            if (world.minecraft && world.minecraft.soundManager) {
                world.minecraft.soundManager.playGuiClick();
            }
            return true;
        }
        return false;
    }

    onRender(world, x, y, z, blockRenderer) {
        blockRenderer.renderLever(world, this, x, y, z);
        return true;
    }

    isSolid() { return false; }
    isTranslucent() { return false; }
    canCastAmbientOcclusion() { return false; }

    getTextureForFace(face, data, x, y, z, world) {
        return 'lever';
    }

    getBoundingBox(world, x, y, z) {
        const faceIndex = world ? BlockBluestoneLever.getMountedFace(world.getBlockDataAt(x, y, z)) : 0;
        switch (faceIndex) {
            case 1: // ceiling
                return new BoundingBox(0.25, 0.375, 0.3125, 0.75, 1, 0.6875);
            case 2: // north wall
                return new BoundingBox(0.25, 0.3125, 0, 0.75, 0.6875, 0.625);
            case 3: // south wall
                return new BoundingBox(0.25, 0.3125, 0.375, 0.75, 0.6875, 1);
            case 4: // west wall
                return new BoundingBox(0, 0.25, 0.3125, 0.625, 0.75, 0.6875);
            case 5: // east wall
                return new BoundingBox(0.375, 0.25, 0.3125, 1, 0.75, 0.6875);
            default: // floor
                return new BoundingBox(0.25, 0, 0.3125, 0.75, 0.625, 0.6875);
        }
    }
}
