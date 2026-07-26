import Block from "../Block.js";
import BoundingBox from "../../../../util/BoundingBox.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class BlockRedstoneDust extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Redstone Dust";
        this.hardness = 0;
        this.sound = Block.sounds.stone;
        this.noFaceCull = true;
        this.isRedstoneDust = true;
    }

    getTextureForFace(face, data, x, y, z, world) {
        if (face !== EnumBlockFace.BOTTOM && face !== EnumBlockFace.TOP) {
            return 'none';
        }
        let connections = this.getConnections(world, x, y, z);
        if (connections === 0) return 'redstone_dust_dot';
        if (connections === 1 || connections === 2 || connections === 3) return 'redstone_dust_line0';
        if (connections === 4 || connections === 8 || connections === 12) return 'redstone_dust_line';
        return 'redstone_dust_cross';
    }

    getColor() {
        return 0x4B0000;
    }

    isSolid() {
        return false;
    }

    getConnections(world, x, y, z) {
        if (!world) return 0;
        let conn = 0;
        if (this.isDustAt(world, x, y, z - 1)) conn |= 1;
        if (this.isDustAt(world, x, y, z + 1)) conn |= 2;
        if (this.isDustAt(world, x - 1, y, z)) conn |= 4;
        if (this.isDustAt(world, x + 1, y, z)) conn |= 8;
        return conn;
    }

    isDustAt(world, x, y, z) {
        let typeId = world.getBlockAt(x, y, z);
        if (typeId === 0) return false;
        let block = Block.getById(typeId);
        return block !== null && block.isRedstoneDust === true;
    }

    isSolid() {
        return false;
    }

    isTranslucent() {
        return true;
    }

    getBoundingBox(world, x, y, z) {
        return new BoundingBox(0, 0, 0, 1, 0.0625, 1);
    }

    getCollisionBoundingBox(world, x, y, z) {
        return new BoundingBox(0, 0, 0, 0, 0, 0);
    }

    shouldRenderFace(world, x, y, z, face) {
        if (face === EnumBlockFace.BOTTOM) return false;
        return true;
    }

    canCastAmbientOcclusion() {
        return false;
    }

    getAmbientOcclusion() {
        return false;
    }

    onBlockPlaced(world, x, y, z, face) {
        world.onBlockChanged(x - 1, y, z);
        world.onBlockChanged(x + 1, y, z);
        world.onBlockChanged(x, y, z - 1);
        world.onBlockChanged(x, y, z + 1);
    }

    onBlockTick(world, x, y, z) {
        world.onBlockChanged(x, y, z);
    }
}
