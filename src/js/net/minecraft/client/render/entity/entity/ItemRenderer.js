import EntityRenderer from "../EntityRenderer.js";
import Tessellator from "../../Tessellator.js";
import MathHelper from "../../../../util/MathHelper.js";

export default class ItemRenderer extends EntityRenderer {
    constructor(worldRenderer) {
        super(null);
        this.worldRenderer = worldRenderer;
        this.blockRenderer = this.worldRenderer.blockRenderer;
        this.material = null;
        this.mesh = null;
        this.geometry = null;
    }

    disposeMesh() {
        if (this.mesh) {
            this.group.remove(this.mesh);
            if (this.geometry) {
                this.geometry.dispose(); 
            }
            this.geometry = null;
            this.mesh = null;
        }
    }

    hideMesh() {
        if (this.group) {
            this.group.visible = false;
        }
    }

    rebuild(entity) {
        let meta = {};
        this.fillMeta(entity, meta);
        this.group.buildMeta = meta;

        this.disposeMesh(); 

        const block = entity.getBlock();

        if (block) {
            this.group.visible = true;
            let brightness = meta.brightness;
            this.mesh = this.blockRenderer.renderBlockInNullWorld(
                this.group, 
                block, 
                brightness, 
                entity.x,
                entity.y + 0.5,
                entity.z
            );

            if (this.mesh) {
                this.geometry = this.mesh.geometry;
            }
        } else {
            this.group.visible = false;
        }
    }

    render(entity, partialTicks) {
        this.rebuild(entity);
    
        if (entity.isDead) {
            this.group.visible = false; 
            return;
        }

        let interpolatedX = entity.x;
        let interpolatedY = entity.y;
        let interpolatedZ = entity.z;

        if (this.mesh) {
            this.mesh.scale.set(0.25, 0.25, 0.25);
            this.mesh.position.set(interpolatedX, interpolatedY + 0.5, interpolatedZ);
        }
        
        let rotationPitch = entity.prevRotationPitch + (entity.rotationPitch - entity.prevRotationPitch) * partialTicks;
        
        if (this.mesh) {
            this.mesh.rotation.y = MathHelper.toRadians(rotationPitch);
        }

        this.group.visible = true;
    }

    prepareModel(entity) {
        this.rebuild(entity);
    }
    
    fillMeta(entity, meta) {
        meta.brightness = entity.getEntityBrightness();
        meta.blockId = entity.getBlockId();
        meta.tickCount = entity.tickCount;
    }
}
