import Block from "../Block.js";

export default class BlockLeave extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Oak Leaves";
        this.hardness = 0.2;

        // Sound
        this.sound = Block.sounds.leaves;
    }

    getTextureForFace(face) {
        return 'oak_leaves';
    }
    
    getDrop(world, x, y, z) {
        return [0, 1];
    }

    getColor(world, x, y, z, face) {
        if (world === null) {
            return 0 << 16 | 255 << 8 | 0;
        }

        let temperature = world.getTemperature(x, y, z);
        let humidity = world.getHumidity(x, y, z);
        return world.minecraft.grassColorizer.getColor(temperature, humidity);
    }
}