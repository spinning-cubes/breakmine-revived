import Entity from "./Entity.js";
import Block from "../world/block/Block.js";

export default class ItemEntity extends Entity {

    static GRAVITY = 0.04;
    static DRAG = 0.98;

    constructor(minecraft, world, blockId, x, y, z) {
        super(minecraft, world, -2); 

        this.width = 0.5;
        this.height = 0.5;
        
        this.blockId = blockId;
        this.block = Block.getById(blockId);

        this.x = x;
        this.y = y;
        this.z = z;

        this.setPositionAndRotation(x + 0.25, y, z + 0.25, 0, 0); 
        this.setPosition(this.x, this.y, this.z);
        
        this.motionY = 0.0;
        this.fallTime = 0;

        this.tickCount = 0;
        this.initRenderer(); 
    }

    onEntityUpdate() {
        super.onEntityUpdate(); 

        if (this.isDead) return;

        this.tickCount += 1;
        
        this.motionY -= ItemEntity.GRAVITY;
        this.motionX *= ItemEntity.DRAG;
        this.motionZ *= ItemEntity.DRAG;
        
        this.setRotation(0, this.tickCount * 2);

        this.moveCollide(this.motionX, this.motionY, this.motionZ);

        if (this.onGround) {
            this.fallTime++;
            
            this.motionX *= 0.7;
            this.motionZ *= 0.7;
            this.motionY = 0;
            
            if (this.fallTime > 20) {
                this.motionX = 0;
                this.motionZ = 0;
            }
        } else {
            this.fallTime++;
        }
    }
    
    getBlockId() {
        return this.blockId;
    }
    
    getBlock() {
        return this.block;
    }
}