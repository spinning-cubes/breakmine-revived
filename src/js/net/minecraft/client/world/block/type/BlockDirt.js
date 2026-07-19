import Block from "../Block.js";
import { BlockRegistry } from "../BlockRegistry.js";

export default class BlockDirt extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Dirt";
        this.hardness = 0.5;

        // Sound
        this.sound = Block.sounds.gravel;
    }
    
    onBlockPlaced(world, x, y, z, face) {
        world.scheduleBlockTick(x, y, z, 120);
    }

    onBlockTick(world, x, y, z) {
        if (!world.isSolidBlockAt(x, y + 1, z) && (
                world.getBlockAt(x - 1, y, z) === BlockRegistry.GRASS.id ||
                world.getBlockAt(x + 1, y, z) === BlockRegistry.GRASS.id ||
                world.getBlockAt(x, y, z - 1) === BlockRegistry.GRASS.id ||
                world.getBlockAt(x, y, z + 1) === BlockRegistry.GRASS.id)) {
            world.setBlockAt(x, y, z, BlockRegistry.GRASS.id);
        } else {
            world.scheduleBlockTick(x, y, z, 120);
        }
    }

    getTextureForFace(face) {
        return 'dirt';
    }
}