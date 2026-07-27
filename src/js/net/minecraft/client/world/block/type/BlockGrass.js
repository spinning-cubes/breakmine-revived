import Block from "../Block.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";
import { BlockRegistry } from "../BlockRegistry.js";

export default class BlockGrass extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Grass Block";
        this.hardness = 0.6;

        // Sound
        this.sound = Block.sounds.grass;
    }
    
    getPreferredToolType() {
        return 'shovel';
    }
    
    onBlockPlaced(world, x, y, z, face) {
        world.scheduleBlockTick(x, y, z, 120);
    }

    onBlockTick(world, x, y, z) {
        if (world.isSolidBlockAt(x, y + 1, z)) {
            world.setBlockAt(x, y, z, BlockRegistry.DIRT.id);
        } else {
            world.scheduleBlockTick(x, y, z, 60);
        }
    }

    getColor(world, x, y, z, face) {
        // Only top face has a biome color
        if (face !== EnumBlockFace.TOP) {
            return 0xFFFFFF;
        }

        // Inventory items have a default color
        if (world === null) {
            return 0x7cbd6b;
        }

        let temperature = world.getTemperature(x, y, z);
        let humidity = world.getHumidity(x, y, z);
        return world.minecraft.grassColorizer.getColor(temperature, humidity);
    }

    getDrop(world, x, y, z) {
        return [BlockRegistry.DIRT.getId(), 1]; // Drop dirt block
    }

    getParticleTextureFace() {
        return EnumBlockFace.NORTH;
    }

    getTextureForFace(face) {
        switch (face) {
            case EnumBlockFace.TOP:
                return 'grass_top';
            case EnumBlockFace.BOTTOM:
                return 'dirt';
            default:
                return 'grass_side';
        }
    }

}