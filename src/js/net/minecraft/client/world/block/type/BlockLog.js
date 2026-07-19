import Block from "../Block.js";
import EnumBlockFace from "../../../../util/EnumBlockFace.js";

export default class BlockLog extends Block {

    constructor(id, textureSlotId) {
        super(id, textureSlotId);
        this.description = "Oak Log";
        this.hardness = 2.0;

        // Sound
        this.sound = Block.sounds.wood;
    }

    getTextureForFace(face, data = 0) {
        if (face.isYAxis() && data === 0) {
            return 'oak_log_top';
        }

        // Determine rotation based on block data
        // 0 = upright (default), 1-3 = rotated on X/Z axis
        if (data === 0) {
            return 'oak_log'; // Upright
        } else if (data === 1) {
            // Rotated along X axis (east-west)
            return face === EnumBlockFace.EAST || face === EnumBlockFace.WEST ? 'oak_log_top' : 'oak_log';
        } else if (data === 2) {
            // Rotated along Z axis (north-south)
            return face === EnumBlockFace.NORTH || face === EnumBlockFace.SOUTH ? 'oak_log_top' : 'oak_log';
        } else {
            return 'oak_log';
        }
    }
}