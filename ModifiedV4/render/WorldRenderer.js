import BlockRenderer from "./BlockRenderer.js";
import EntityRenderManager from "./entity/EntityRenderManager.js";
import MathHelper from "../../util/MathHelper.js";
import Block from "../world/block/Block.js";
import ItemTool from "../world/block/type/ItemTool.js";
import BoundingBox from "../../util/BoundingBox.js";
import Tessellator from "./Tessellator.js";
import ChunkSection from "../world/ChunkSection.js";
import Random from "../../util/Random.js";
import Vector3 from "../../util/Vector3.js";
import TextureAtlas from "./TextureAtlas.js";
import ItemStack from "../item/ItemStack.js";
import * as THREE from "../../../../../../libraries/three.module.js";
import TranslucentMeshBatcher from "./TranslucentMeshBatcher.js";
import GuiFunctions from "../gui/screens/GuiFunctions.js";
 
export default class WorldRenderer {

    static THIRD_PERSON_DISTANCE = 4;

    constructor(minecraft, window) {
        this.minecraft = minecraft;
        this.window = window;
        this.chunkSectionUpdateQueue = [];

        this.tessellator = new Tessellator();

        // Create world camera first (needed for window size update)
        this.camera = new THREE.PerspectiveCamera(0, 1, 0.001, 1000);
        this.camera.rotation.order = 'ZYX';
        this.camera.up = new THREE.Vector3(0, 0, 1);

        // Frustum
        this.frustum = new THREE.Frustum();

        // Create background scene
        this.background = new THREE.Scene();
        this.background.matrixAutoUpdate = false;

        // Create world scene
        this.scene = new THREE.Scene();
        this.scene.matrixAutoUpdate = false;

        // Create overlay for first person model rendering
        this.overlay = new THREE.Scene();
        this.overlay.matrixAutoUpdate = false;

        // Create web renderer
        this.webRenderer = new THREE.WebGLRenderer({
            canvas: this.window.canvasWorld,
            antialias: false,
            alpha: true
        });

        // Settings
        this.webRenderer.setSize(this.window.width, this.window.height);
        this.webRenderer.shadowMap.enabled = true;
        this.webRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.webRenderer.autoClear = false;
        this.webRenderer.sortObjects = false; // change if buggy!!
        this.webRenderer.setClearColor(0x000000, 0);
        this.webRenderer.clear();

        // Create texture atlas for dynamic block textures
        this.textureAtlas = new TextureAtlas(minecraft);
        
        // Load terrain texture (fallback for now)
        this.textureTerrain = minecraft.getThreeTexture('terrain/terrain.png');
        this.textureTerrain.magFilter = THREE.NearestFilter;
        this.textureTerrain.minFilter = THREE.NearestFilter;

        // Load sun texture
        this.textureSun = minecraft.getThreeTexture('terrain/sun.png');
        this.textureSun.magFilter = THREE.NearestFilter;
        this.textureSun.minFilter = THREE.NearestFilter;

        // Load moon texture
        this.textureMoon = minecraft.getThreeTexture('terrain/moon.png');
        this.textureMoon.magFilter = THREE.NearestFilter;
        this.textureMoon.minFilter = THREE.NearestFilter;

        // Block Renderer
        this.blockRenderer = new BlockRenderer(this);
        
        // Expose texture atlas for external use
        this.getTextureAtlas = () => this.textureAtlas;
        this.getTextureCoords = (textureName) => this.textureAtlas.getTextureCoords(textureName);
        this.getTextureIndex = (textureName) => this.textureAtlas.getTextureIndex(textureName);
        this.getTextureUVs = (textureName) => this.textureAtlas.getUVs(textureName);

        // Entity render manager
        this.entityRenderManager = new EntityRenderManager(this);

        this.equippedProgress = 0;
        this.prevEquippedProgress = 0;
        this.itemToRender = new ItemStack(0, 0);

        this.prevFogBrightness = 0;
        this.fogBrightness = 0;

        this.flushRebuild = false;

        this.lastHitResult = null;

        // Create sky
        this.generateSky();

        // Create block hit box (will be updated dynamically based on block bounding boxes)
        this.blockHitBox = new THREE.Group();
        this.blockHitBoxMaterial = new THREE.LineBasicMaterial({
            color: 0x000000
        });
        
        // Add block hit box to scene
        this.scene.add(this.blockHitBox);

        // Create chunk boundary helper
        this.chunkBoundaryMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 3,
            depthTest: false,
            transparent: true,
            opacity: 0.85
        });
        this.chunkBoundaryLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.chunkBoundaryMaterial);
        this.chunkBoundaryLines.frustumCulled = false;
        this.chunkBoundaryLines.renderOrder = 9999;
        this.overlay.add(this.chunkBoundaryLines);

        this.chunkSectionMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });
        this.chunkSectionLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.chunkSectionMaterial);
        this.chunkSectionLines.frustumCulled = false;
        this.chunkSectionLines.renderOrder = 9999;
        this.overlay.add(this.chunkSectionLines);

        // Create entity bounding box helper
        this.entityBBoxMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        this.entityBBoxGroup = new THREE.Group();
        this.entityBBoxGroup.frustumCulled = false;
        this.entityBBoxGroup.renderOrder = 9999;
        this.entityBBoxGroup.visible = false;
        this.overlay.add(this.entityBBoxGroup);

        // Create break overlay mesh for survival block damage
        this.blockBreakGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.blockBreakMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.75,
            polygonOffset: true,
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -1.0,
            alphaTest: 0.1,
            side: THREE.DoubleSide
        });
        this.blockBreakMesh = new THREE.Mesh(this.blockBreakGeometry, this.blockBreakMaterial);
        this.blockBreakMesh.visible = false;
        this.blockBreakMesh.frustumCulled = false;
        this.blockBreakMesh.renderOrder = 10000;
        this.overlay.add(this.blockBreakMesh);

        this.translucentMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            alphaTest: 0.1,
            side: THREE.FrontSide
        });

        // Initialize the batcher, passing the scene and the material
        this.translucentBatcher = new TranslucentMeshBatcher(this.scene, this.translucentMaterial);

        // Initialize texture atlas asynchronously
        this.initialize().catch(error => {
            console.error("Failed to initialize WorldRenderer:", error);
        });
    }

    async initialize() {
        // Load texture atlas asynchronously
        await this.textureAtlas.loadTextures();
        
        // Rebind block renderer to texture atlas after it's loaded
        if (this.blockRenderer && this.textureAtlas.isLoaded()) {
            this.blockRenderer.tessellator.bindTexture(this.textureAtlas.getTexture());
        }
        
        // Set texture on translucent batcher material
        if (this.translucentBatcher && this.textureAtlas.isLoaded()) {
            this.translucentBatcher.mesh.material.map = this.textureAtlas.getTexture();
            this.translucentBatcher.mesh.material.needsUpdate = true;
        }

        // Use a cloned atlas texture for block damage overlay so the material can use offset/repeat
        if (this.blockBreakMaterial && this.textureAtlas.isLoaded()) {
            this.blockBreakMaterial.map = this.textureAtlas.getTexture().clone();
            this.blockBreakMaterial.map.offset.set(0, 0);
            this.blockBreakMaterial.map.repeat.set(1, 1);
            this.blockBreakMaterial.map.wrapS = THREE.RepeatWrapping;
            this.blockBreakMaterial.map.wrapT = THREE.RepeatWrapping;
            this.blockBreakMaterial.map.needsUpdate = true;
            this.blockBreakMaterial.needsUpdate = true;
        }
        
        // Rebuild all chunks after texture atlas is loaded to fix purple textures
        this.rebuildAll();
    }

    render(partialTicks) {
        // Setup camera
        this.orientCamera(partialTicks);

        // Render chunks
        let player = this.minecraft.player;
        let cameraChunkX = Math.floor(player.x) >> 4;
        let cameraChunkZ = Math.floor(player.z) >> 4;
        this.renderChunks(cameraChunkX, cameraChunkZ);
        this.updateChunkBoundaryLines(cameraChunkX, cameraChunkZ);

        // Render sky
        this.renderSky(partialTicks);

        // Render target block
        this.renderBlockHitBox(player, partialTicks);

        // Render entity bounding boxes
        this.updateEntityBoundingBoxes(partialTicks);

        // Render survival block damage overlay
        this.updateBlockBreakOverlay(partialTicks);

        // Render particles
        this.minecraft.particleRenderer.renderParticles(player, partialTicks);

        // Hide all entities and make them visible during rendering
        for (let entity of this.minecraft.world.entities) {
            if (entity && entity.renderer && entity.renderer.group) {
                entity.renderer.group.visible = false;
            }
            if (entity && entity.renderer && entity.renderer.nametagGroup) {
                entity.renderer.nametagGroup.visible = false;
            }
            if (entity && entity.renderer && entity.renderer.shadowGroup) {
                entity.renderer.shadowGroup.visible = false;
            }
        }

        // Render entities
        for (let entity of this.minecraft.world.entities) {
            if (!entity || !entity.renderer) continue;
            
            if (entity === player && this.minecraft.settings.thirdPersonView === 0) {
                continue;
            }

            // Don't render spectator entities to non-spectator local player
            if (entity.spectator && !player.spectator) {
                continue;
            }

            // Check if entity's chunk is loaded
            let entityChunkX = Math.floor(entity.x / 16);
            let entityChunkZ = Math.floor(entity.z / 16);
            let chunk = this.minecraft.world.getChunkProvider().getChunkAt(entityChunkX, entityChunkZ);

            if (!chunk || !chunk.loaded) {
                continue;
            }

            // Render entity
            entity.renderer.render(entity, partialTicks);
            if (entity.renderer.group) {
                entity.renderer.group.visible = true;
            }
        }

        // Render hand
        this.renderHand(partialTicks);

        // Render background scene
        this.webRenderer.render(this.background, this.camera);

        let cameraPos = {
            x: player.x,
            y: player.y + player.getEyeHeight(),
            z: player.z
        };

        // 1. Clear the batcher
        this.translucentBatcher.clear();

        // 2. Steal geometry from all visible chunks and hide per-section translucent meshes
        for (let [index, chunk] of this.minecraft.world.getChunkProvider().getChunks()) {
            if (!chunk.group.visible) continue;
            
            for (let y in chunk.sections) {
                let section = chunk.sections[y];
                if (!section.group.visible || section.isEmpty()) continue;
                
                for (let child of section.group.children) {
                    if (child.isMesh && child.userData.isTranslucent) {
                        this.translucentBatcher.addMesh(child);
                        child.visible = false; // Hide per-section mesh, batcher replaces it
                    }
                }
            }
        }

        // 3. Sort the entire world's translucent faces perfectly and upload to GPU
        this.translucentBatcher.finalize(cameraPos);

        // Move batcher mesh to end of scene children so it renders LAST
        // (sortObjects=false means Three.js uses scene traversal order, not renderOrder)
        this.scene.remove(this.translucentBatcher.mesh);
        this.scene.add(this.translucentBatcher.mesh);

        // Render actual scene (batcher mesh draws last, on top of entities/chunks)
        this.webRenderer.render(this.scene, this.camera);

        // Render overlay with the same FOV as the world
        this.overlay.updateMatrixWorld(true);
        this.webRenderer.render(this.overlay, this.camera);
    }

    updateChunkBoundaryLines(cameraChunkX, cameraChunkZ) {
        if (!this.chunkBoundaryLines || !this.chunkSectionLines) {
            return;
        }

        if (!this.minecraft.settings.showChunkBoundaries) {
            this.chunkBoundaryLines.visible = false;
            this.chunkSectionLines.visible = false;
            return;
        }

        this.chunkBoundaryLines.visible = true;
        this.chunkSectionLines.visible = true;

        const player = this.minecraft.player;
        const y = player ? player.y + 0.2 : 0.5;

        // Show the current chunk plus the 8 adjacent chunks in a 3x3 grid.
        const chunkRadius = 1;
        const startX = (cameraChunkX - chunkRadius) * 16;
        const endX = (cameraChunkX + chunkRadius + 1) * 16;
        const startZ = (cameraChunkZ - chunkRadius) * 16;
        const endZ = (cameraChunkZ + chunkRadius + 1) * 16;

        let boundaryPositions = [];
        for (let x = startX; x <= endX; x += 16) {
            boundaryPositions.push(x, y, startZ, x, y, endZ);
        }
        for (let z = startZ; z <= endZ; z += 16) {
            boundaryPositions.push(startX, y, z, endX, y, z);
        }

        const boundaryGeometry = new THREE.BufferGeometry();
        boundaryGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(boundaryPositions), 3));
        boundaryGeometry.setDrawRange(0, boundaryPositions.length / 3);
        if (this.chunkBoundaryLines.geometry) {
            this.chunkBoundaryLines.geometry.dispose();
        }
        this.chunkBoundaryLines.geometry = boundaryGeometry;

        // Show chunk section borders for the current chunk in yellow.
        const chunkBaseX = cameraChunkX * 16;
        const chunkBaseZ = cameraChunkZ * 16;
        const sectionHeight = ChunkSection.SIZE;
        const minSectionY = 0;
        const maxSectionY = Math.max(sectionHeight, Math.ceil((player ? player.y + 32 : 64) / sectionHeight) * sectionHeight);

        let sectionPositions = [];
        for (let sectionY = minSectionY; sectionY <= maxSectionY; sectionY += sectionHeight) {
            sectionPositions.push(chunkBaseX, sectionY, chunkBaseZ, chunkBaseX + 16, sectionY, chunkBaseZ);
            sectionPositions.push(chunkBaseX + 16, sectionY, chunkBaseZ, chunkBaseX + 16, sectionY, chunkBaseZ + 16);
            sectionPositions.push(chunkBaseX + 16, sectionY, chunkBaseZ + 16, chunkBaseX, sectionY, chunkBaseZ + 16);
            sectionPositions.push(chunkBaseX, sectionY, chunkBaseZ + 16, chunkBaseX, sectionY, chunkBaseZ);
        }

        const verticalTop = maxSectionY + sectionHeight;
        sectionPositions.push(chunkBaseX, minSectionY, chunkBaseZ, chunkBaseX, verticalTop, chunkBaseZ);
        sectionPositions.push(chunkBaseX + 16, minSectionY, chunkBaseZ, chunkBaseX + 16, verticalTop, chunkBaseZ);
        sectionPositions.push(chunkBaseX + 16, minSectionY, chunkBaseZ + 16, chunkBaseX + 16, verticalTop, chunkBaseZ + 16);
        sectionPositions.push(chunkBaseX, minSectionY, chunkBaseZ + 16, chunkBaseX, verticalTop, chunkBaseZ + 16);

        const sectionGeometry = new THREE.BufferGeometry();
        sectionGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sectionPositions), 3));
        sectionGeometry.setDrawRange(0, sectionPositions.length / 3);
        if (this.chunkSectionLines.geometry) {
            this.chunkSectionLines.geometry.dispose();
        }
        this.chunkSectionLines.geometry = sectionGeometry;
    }

    onTick() {
        // Rebuild chunk sections each tick
        let rebuildCount = Math.min(32, this.chunkSectionUpdateQueue.length);
        for (let i = 0; i < rebuildCount; i++) {
            if (this.chunkSectionUpdateQueue.length !== 0) {
                let chunkSection = this.chunkSectionUpdateQueue.shift();
                if (chunkSection != null) {
                    // Rebuild chunk
                    chunkSection.rebuild(this);
                }
            }
        }

        this.prevFogBrightness = this.fogBrightness;
        this.prevEquippedProgress = this.equippedProgress;

        let player = this.minecraft.player;
        let itemStack = player.inventory.getItemInSelectedSlot();

        let showHand = false;
        let stackChanged = !this.itemToRender.isItemEqual(itemStack)
            || this.itemToRender.getCount() !== itemStack.getCount()
            || this.itemToRender.isEmpty() !== itemStack.isEmpty();
        if (stackChanged) {
            showHand = true;
        }

        // Update equip progress
        this.equippedProgress += MathHelper.clamp((showHand ? 0.0 : 1.0) - this.equippedProgress, -0.4, 0.4);

        if (this.equippedProgress < 0.1) {
            this.itemToRender = itemStack.copy();
        }

        // Update fog brightness
        let brightnessAtPosition = this.minecraft.world.getLightBrightnessForEntity(player);
        let renderDistance = this.minecraft.settings.viewDistance / 32.0;
        let fogBrightness = brightnessAtPosition * (1.0 - renderDistance) + renderDistance;
        this.fogBrightness += (fogBrightness - this.fogBrightness) * 0.1;
    }

    orientCamera(partialTicks) {
        let player = this.minecraft.player;

        // Reset rotation stack
        let stack = this.camera;

        // Position
        let x = player.prevX + (player.x - player.prevX) * partialTicks;
        let y = player.prevY + (player.y - player.prevY) * partialTicks + player.getEyeHeight();
        let z = player.prevZ + (player.z - player.prevZ) * partialTicks;

        // Rotation
        let yaw = player.prevRotationYaw + (player.rotationYaw - player.prevRotationYaw) * partialTicks;
        let pitch = player.prevRotationPitch + (player.rotationPitch - player.prevRotationPitch) * partialTicks;

        // Add camera offset
        let mode = this.minecraft.settings.thirdPersonView;
        if (mode !== 0) {
            let distance = WorldRenderer.THIRD_PERSON_DISTANCE;
            let frontView = mode === 2;

            // Calculate vector of yaw and pitch
            let vector = player.getVectorForRotation(pitch, yaw);

            // Calculate max possible position of the third person camera
            let maxX = x - vector.x * distance * (frontView ? -1 : 1);
            let maxY = y - vector.y * distance * (frontView ? -1 : 1);
            let maxZ = z - vector.z * distance * (frontView ? -1 : 1);

            // Make 8 different ray traces to make sure we don't get stuck in walls
            for (let i = 0; i < 8; i++) {
                // Calculate all possible offset variations (Basically a binary counter)
                let offsetX = ((i & 1) * 2 - 1) * 0.1;
                let offsetY = ((i >> 1 & 1) * 2 - 1) * 0.1;
                let offsetZ = ((i >> 2 & 1) * 2 - 1) * 0.1;

                // Calculate ray trace from and to position
                let from = new Vector3(x, y, z);
                let to = new Vector3(maxX, maxY, maxZ);

                // Add offset of this variation
                from = from.addVector(offsetX, offsetY, offsetZ);
                to = to.addVector(offsetX, offsetY, offsetZ);

                // Make ray trace
                let target = this.minecraft.world.rayTraceBlocks(from, to);
                if (target === null) {
                    continue;
                }

                // Calculate distance to collision
                let distanceToCollision = target.vector.distanceTo(new Vector3(x, y, z));
                if (distanceToCollision < distance) {
                    distance = distanceToCollision;
                }
            }

            // Move camera to third person sphere
            x -= vector.x * distance * (frontView ? -1 : 1);
            y -= vector.y * distance * (frontView ? -1 : 1);
            z -= vector.z * distance * (frontView ? -1 : 1);

            // Flip camera around if front view is enabled
            if (frontView) {
                pitch *= -1;
                yaw += 180;
            }
        }

        // Update camera rotation
        stack.rotation.x = -MathHelper.toRadians(pitch);
        stack.rotation.y = -MathHelper.toRadians(yaw + 180);
        stack.rotation.z = 0;

        // Update camera position
        stack.position.set(x, y, z);

        // Apply bobbing animation
        if (mode === 0 && this.minecraft.settings.viewBobbing) {
            this.bobbingAnimation(player, stack, partialTicks);
        }

        // Update FOV
        this.camera.fov = this.minecraft.settings.fov + player.getFOVModifier();
        this.camera.updateProjectionMatrix();

        // Update frustum
        this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));

        // Setup fog
        this.setupFog(x, z, player.isHeadInWater(), partialTicks, player.isHeadInLava());
    }

    generateSky() {
        // Create background center group
        this.backgroundCenter = new THREE.Object3D();
        this.background.add(this.backgroundCenter);

        let size = 64;
        let scale = 256 / size + 2;

        // Generate sky color
        {
            let y = 16;
            this.listSky = new THREE.Object3D();
            this.tessellator.startDrawing();
            this.tessellator.setColor(1, 1, 1);
            for (let x = -size * scale; x <= size * scale; x += size) {
                for (let z = -size * scale; z <= size * scale; z += size) {
                    this.tessellator.addVertex(x + size, y, z);
                    this.tessellator.addVertex(x, y, z);
                    this.tessellator.addVertex(x, y, z + size);
                    this.tessellator.addVertex(x + size, y, z + size);
                }
            }
            let mesh = this.tessellator.draw(this.listSky);
            mesh.material.depthTest = false;
            this.backgroundCenter.add(this.listSky);
        }

        // Generate sunrise/sunset color
        {
            this.listSunset = new THREE.Object3D();
            this.tessellator.startDrawing();

            let amount = 16;
            let width = (Math.PI * 2.0) / amount;

            for (let index = 0; index < amount; index++) {
                let rotation = (index * Math.PI * 2.0) / amount;

                let x1 = Math.sin(rotation);
                let y1 = Math.cos(rotation);

                let x2 = Math.sin(rotation + width);
                let y2 = Math.cos(rotation + width);

                this.tessellator.setColor(1, 1, 1, 1);
                this.tessellator.addVertex(0.0, 100, 0.0);
                this.tessellator.addVertex(0.0, 100, 0.0);

                this.tessellator.setColor(1, 1, 1, 0);
                this.tessellator.addVertex(x1 * 120, y1 * 120, -y1 * 40);
                this.tessellator.addVertex(x2 * 120, y2 * 120, -y2 * 40);
            }

            let mesh = this.tessellator.draw(this.listSunset);
            mesh.material = mesh.material.clone();
            mesh.material.depthTest = false;
            mesh.material.opacity = 0.6;
            mesh.material.side = THREE.DoubleSide;
            this.backgroundCenter.add(this.listSunset);
        }

        // Create cycle group
        this.cycleGroup = new THREE.Object3D();

        // Generate stars
        {
            this.listStars = new THREE.Object3D();
            this.tessellator.startDrawing();
            this.tessellator.setColor(1, 1, 1);

            // Generate 1500 stars
            let random = new Random(10842);
            for (let i = 0; i < 1500; i++) {
                // Random vector
                let vectorX = random.nextFloat() * 2.0 - 1.0;
                let vectorY = random.nextFloat() * 2.0 - 1.0;
                let vectorZ = random.nextFloat() * 2.0 - 1.0;

                // Skip invalid vectors
                let distance = vectorX * vectorX + vectorY * vectorY + vectorZ * vectorZ;
                if (distance >= 1.0 || distance <= 0.01) {
                    continue;
                }

                // Create sphere
                distance = 1.0 / Math.sqrt(distance);
                vectorX *= distance;
                vectorY *= distance;
                vectorZ *= distance;

                // Increase sphere size
                let x = vectorX * 100;
                let y = vectorY * 100;
                let z = vectorZ * 100;

                // Rotate the stars on the sphere
                let rotationX = Math.atan2(vectorX, vectorZ);
                let sinX = Math.sin(rotationX);
                let cosX = Math.cos(rotationX);

                // Face the stars to the middle of the sphere
                let rotationY = Math.atan2(Math.sqrt(vectorX * vectorX + vectorZ * vectorZ), vectorY);
                let sinY = Math.sin(rotationY);
                let cosY = Math.cos(rotationY);

                // Tilt the stars randomly
                let rotationZ = random.nextFloat() * Math.PI * 2;
                let sinZ = Math.sin(rotationZ);
                let cosZ = Math.cos(rotationZ);

                // Random size of the star
                let size = 0.25 + random.nextFloat() * 0.25;

                // Add vertices for each edge of the star
                for (let edge = 0; edge < 4; edge++) {
                    // Calculate the position of the edge on a 2D plane
                    let tileX = ((edge & 2) - 1) * size;
                    let tileZ = ((edge + 1 & 2) - 1) * size;

                    // Project tile position onto the sphere
                    let sphereX = tileX * cosZ - tileZ * sinZ;
                    let sphereY = tileZ * cosZ + tileX * sinZ;
                    let sphereZ = -sphereX * cosY;

                    // Calculate offset of the edge on the sphere
                    let offsetX = sphereZ * sinX - sphereY * cosX;
                    let offsetY = sphereX * sinY;
                    let offsetZ = sphereY * sinX + sphereZ * cosX;

                    // Add vertex for the edge of the star
                    this.tessellator.addVertex(x + offsetX, y + offsetY, z + offsetZ);
                }
            }

            let mesh = this.tessellator.draw(this.listStars);
            mesh.material = mesh.material.clone();
            mesh.material.depthTest = true;
            mesh.material.side = THREE.BackSide;
            this.cycleGroup.add(this.listStars);
        }

        // Create sun
        let geometry = new THREE.PlaneGeometry(1, 1);
        let materialSun = new THREE.MeshBasicMaterial({
            side: THREE.FrontSide,
            map: this.textureSun,
            alphaMap: this.textureSun,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        this.sun = new THREE.Mesh(geometry, materialSun);
        this.sun.translateZ(-2);
        this.sun.material.depthTest = false;
        this.cycleGroup.add(this.sun);

        // Create moon
        let materialMoon = new THREE.MeshBasicMaterial({
            side: THREE.BackSide,
            map: this.textureMoon,
            alphaMap: this.textureMoon,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        this.moon = new THREE.Mesh(geometry, materialMoon);
        this.moon.translateZ(2);
        this.moon.material.depthTest = false;
        this.cycleGroup.add(this.moon);

        // Add cycle group before the void to hide the cycling elements behind the void
        this.backgroundCenter.add(this.cycleGroup);

        // Generate void color
        {
            let y = -16;
            this.listVoid = new THREE.Object3D();
            this.tessellator.startDrawing();
            this.tessellator.setColor(1, 1, 1);
            for (let x = -size * scale; x <= size * scale; x += size) {
                for (let z = -size * scale; z <= size * scale; z += size) {
                    this.tessellator.addVertex(x, y, z);
                    this.tessellator.addVertex(x + size, y, z);
                    this.tessellator.addVertex(x + size, y, z + size);
                    this.tessellator.addVertex(x, y, z + size);
                }
            }
            let mesh = this.tessellator.draw(this.listVoid);
            mesh.material = mesh.material.clone();
            mesh.material.depthTest = false;
            mesh.material.opacity = 1;
            this.backgroundCenter.add(this.listVoid);
        }
    }

    renderSky(partialTicks) {
        // Center sky
        this.backgroundCenter.position.copy(this.camera.position);

        // Rotate sky cycle
        let angle = this.minecraft.world.getCelestialAngle(partialTicks);
        this.cycleGroup.rotation.set(angle * Math.PI * 2 + Math.PI / 2, 0, 0);
    }

    setupFog(x, z, inWater, partialTicks, inLava) {
        if (inWater) {
            let color = new THREE.Color(0.2, 0.2, 0.4);
            this.background.background = color;
            this.scene.fog = new THREE.Fog(color, 0.0025, 5);
        } else if (inLava) {
            let color = new THREE.Color(0.6, 0.1, 0.0);
            this.background.background = color;
            this.scene.fog = new THREE.Fog(color, 0.0025, 3);
        } else {
            let world = this.minecraft.world;

            let viewDistance = this.minecraft.settings.viewDistance * ChunkSection.SIZE;
            let viewFactor = 1.0 - Math.pow(0.25 + 0.75 * this.minecraft.settings.viewDistance / 32.0, 0.25);

            let angle = world.getCelestialAngle(partialTicks);

            let skyColor = world.getSkyColor(x, z, partialTicks);
            let fogColor = world.getFogColor(partialTicks);
            let sunsetColor = world.getSunriseSunsetColor(partialTicks);

            let starBrightness = world.getStarBrightness(partialTicks);
            let brightness = this.prevFogBrightness + (this.fogBrightness - this.prevFogBrightness) * partialTicks;

            let red = (fogColor.x + (skyColor.x - fogColor.x) * viewFactor) * brightness;
            let green = (fogColor.y + (skyColor.y - fogColor.y) * viewFactor) * brightness;
            let blue = (fogColor.z + (skyColor.z - fogColor.z) * viewFactor) * brightness;

            // Update background color
            this.background.background = new THREE.Color(red, green, blue);

            // Update fog color
            this.scene.fog = new THREE.Fog(new THREE.Color(red, green, blue), 0.0025, viewDistance * 2);

            let skyMesh = this.listSky.children[0];
            let voidMesh = this.listVoid.children[0];
            let starsMesh = this.listStars.children[0];
            let sunsetMesh = this.listSunset.children[0];

            // Update sky and void color
            skyMesh.material.color.set(new THREE.Color(skyColor.x, skyColor.y, skyColor.z));
            voidMesh.material.color.set(new THREE.Color(
                skyColor.x * 0.2 + 0.04,
                skyColor.y * 0.2 + 0.04,
                skyColor.z * 0.6 + 0.1
            ));

            // Update star brightness
            if (starBrightness > 0) {
                starsMesh.material.opacity = starBrightness;
                starsMesh.material.color.set(new THREE.Color(starBrightness, starBrightness, starBrightness));
            }
            this.listStars.visible = starBrightness > 0;

            // Update sunset
            if (sunsetColor !== null) {
                sunsetMesh.material.opacity = sunsetColor.w;
                sunsetMesh.material.color.set(new THREE.Color(sunsetColor.x, sunsetColor.y, sunsetColor.z));
                sunsetMesh.rotation.x = MathHelper.toRadians(angle <= 0.5 ? 90 : 135);
            }
            sunsetMesh.visible = sunsetColor !== null;
        }

        this.background.fog = this.scene.fog;
    }

    renderChunks(cameraChunkX, cameraChunkZ) {
        let world = this.minecraft.world;
        let renderDistance = this.minecraft.settings.viewDistance;

        // Calculate the camera's vertical section index (Y axis)
        let player = this.minecraft.player;
        let cameraChunkY = Math.floor(player.y) >> 4;

        // Update chunks
        for (let [index, chunk] of world.getChunkProvider().getChunks()) {
            let distanceX = Math.abs(cameraChunkX - chunk.x);
            let distanceZ = Math.abs(cameraChunkZ - chunk.z);

            // Is in render distance check
            if (distanceX < renderDistance && distanceZ < renderDistance) {
                // Make chunk visible
                chunk.group.visible = true;
                chunk.loaded = true;

                // For all chunk sections
                for (let y in chunk.sections) {
                    let chunkSection = chunk.sections[y];

                    // Is in camera view check
                    if (this.frustum.intersectsBox(chunkSection.boundingBox) && !chunkSection.isEmpty()) {
                        // Make section visible
                        chunkSection.group.visible = true;

                        // Render chunk section
                        chunkSection.render();

                        // Queue for rebuild
                        if (chunkSection.isModified && !this.chunkSectionUpdateQueue.includes(chunkSection)) {
                            this.chunkSectionUpdateQueue.push(chunkSection);
                        }
                    } else {
                        // Hide section
                        chunkSection.group.visible = false;
                    }
                }
            } else {
                // Hide chunk
                chunk.group.visible = false;

                // Unload chunk
                if (chunk.loaded) {
                    chunk.unload();
                }
            }
        }
    }

    sortTranslucentMeshes() {
        let player = this.minecraft.player;
        let cameraPos = {
            x: player.x,
            y: player.y + player.getEyeHeight(),
            z: player.z
        };

        let world = this.minecraft.world;
        let translucentMeshes = [];

        for (let [index, chunk] of world.getChunkProvider().getChunks()) {
            if (!chunk.group.visible) continue;
            
            for (let y in chunk.sections) {
                let section = chunk.sections[y];
                if (!section.group.visible || section.isEmpty()) continue;
                
                for (let child of section.group.children) {
                    if (child.isMesh && child.userData.isTranslucent) {
                        // 1. Sort the triangles INSIDE this specific mesh
                        this.sortTranslucentGeometry(child, cameraPos);
                        
                        // 2. Collect mesh to sort it against OTHER chunk section meshes
                        let mx = child.matrixWorld.elements[12] + 8; // +8 to get center of 16x16 section
                        let my = child.matrixWorld.elements[13] + 8;
                        let mz = child.matrixWorld.elements[14] + 8;
                        
                        let dx = mx - cameraPos.x;
                        let dy = my - cameraPos.y;
                        let dz = mz - cameraPos.z;
                        
                        translucentMeshes.push({
                            mesh: child,
                            dist: dx * dx + dy * dy + dz * dz
                        });
                    }
                }
            }
        }

        // 3. Sort meshes back to front (far chunks render first)
        translucentMeshes.sort((a, b) => b.dist - a.dist);

        // 4. Assign render order so Three.js draws far meshes first
        for (let i = 0; i < translucentMeshes.length; i++) {
            translucentMeshes[i].mesh.renderOrder = i;
        }
    }

    sortTranslucentGeometry(mesh, cameraWorldPos) {
        let geometry = mesh.geometry;
        let posAttr = geometry.getAttribute('position');
        let vertexCount = posAttr.count;
        
        if (vertexCount === 0) return;

        let indexAttr = geometry.getIndex();
        
        // If the tessellator didn't use an index buffer, create one so we can sort faces easily
        if (!indexAttr) {
            let indices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) {
                indices[i] = i;
            }
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            indexAttr = geometry.getIndex();
        }
        
        let indices = indexAttr.array;
        let faceCount = indices.length / 6; // 2 triangles per face = 6 indices
        
        if (faceCount === 0) return;

        // Get the chunk section's world position from its matrix
        let mx = mesh.matrixWorld.elements[12];
        let my = mesh.matrixWorld.elements[13];
        let mz = mesh.matrixWorld.elements[14];

        let faces = new Array(faceCount);
        
        // Calculate distance for each face
        for (let i = 0; i < faceCount; i++) {
            let idx = i * 6;
            let vIdx = indices[idx]; // Use first vertex of the face as reference point
            
            let dx = posAttr.getX(vIdx) + mx - cameraWorldPos.x;
            let dy = posAttr.getY(vIdx) + my - cameraWorldPos.y;
            let dz = posAttr.getZ(vIdx) + mz - cameraWorldPos.z;
            
            faces[i] = {
                start: idx,
                dist: dx * dx + dy * dy + dz * dz
            };
        }
        
        // Sort faces back to front (furthest faces draw first)
        faces.sort((a, b) => b.dist - a.dist);
        
        // Rebuild the index buffer in the new sorted order
        let newIndices = new indices.constructor(indices.length);
        for (let i = 0; i < faceCount; i++) {
            let src = faces[i].start;
            let dst = i * 6;
            
            // Copy the 6 indices for this face to its new sorted position
            newIndices[dst]     = indices[src];
            newIndices[dst + 1] = indices[src + 1];
            newIndices[dst + 2] = indices[src + 2];
            newIndices[dst + 3] = indices[src + 3];
            newIndices[dst + 4] = indices[src + 4];
            newIndices[dst + 5] = indices[src + 5];
        }
        
        indexAttr.array.set(newIndices);
        indexAttr.needsUpdate = true;
    }

    rebuildAll() {
        let world = this.minecraft.world;
        for (let [index, chunk] of world.getChunkProvider().getChunks()) {
            chunk.setModifiedAllSections();
        }
    }

    renderHand(partialTicks) {
        // Hide hand before rendering
        let player = this.minecraft.player;
        let stack = player.renderer.firstPersonGroup;
        stack.visible = false;

        // Hide hand in spectator mode
        if (player.spectator) return;

        // Hide hand when GUI is hidden (F1 toggle)
        if (GuiFunctions.isGuiHidden()) return;

        let firstPerson = this.minecraft.settings.thirdPersonView === 0;
        let itemStack = firstPerson ? this.itemToRender : player.inventory.getItemInSelectedSlot();
        let hasItem = !itemStack.isEmpty();
        let itemId = itemStack.getType();

        // Hide in third person
        if (!firstPerson) {
            return;
        }

        // Apply matrix mode (Put object in front of camera)
        stack.position.copy(this.camera.position);
        stack.rotation.copy(this.camera.rotation);
        stack.rotation.order = 'ZYX';

        // Scale down
        stack.scale.set(0.0625, 0.0625, 0.0625);

        let equipProgress = this.prevEquippedProgress + (this.equippedProgress - this.prevEquippedProgress) * partialTicks;
        let swingProgress = player.getSwingProgress(partialTicks);

        let pitchArm = player.prevRenderArmPitch + (player.renderArmPitch - player.prevRenderArmPitch) * partialTicks;
        let yawArm = player.prevRenderArmYaw + (player.renderArmYaw - player.prevRenderArmYaw) * partialTicks;

        // Bobbing animation
        if (this.minecraft.settings.viewBobbing) {
            this.bobbingAnimation(player, stack, partialTicks);
        }

        let factor = 0.8;
        let zOffset = Math.sin(swingProgress * Math.PI);
        let yOffset = Math.sin(Math.sqrt(swingProgress) * Math.PI * 2.0);
        let xOffset = Math.sin(Math.sqrt(swingProgress) * Math.PI);

        let sqrtRotation = Math.sin(Math.sqrt(swingProgress) * Math.PI);
        let powRotation = Math.sin(swingProgress * swingProgress * Math.PI);

        // Camera rotation movement
        stack.rotateX(MathHelper.toRadians((player.rotationPitch - pitchArm) * 0.1));
        stack.rotateY(MathHelper.toRadians((player.rotationYaw - yawArm) * 0.1));

        if (hasItem) {
            // Initial offset on screen
            this.translate(stack, -xOffset * 0.4, yOffset * 0.2, -zOffset * 0.2);
            this.translate(stack, 0.7 * factor, -0.65 * factor - (1.0 - equipProgress) * 0.6, -0.9 * factor);

            // Rotation of hand
            stack.rotateY(MathHelper.toRadians(45));
            stack.rotateY(MathHelper.toRadians(-powRotation * 20));
            stack.rotateZ(MathHelper.toRadians(-sqrtRotation * 20));
            stack.rotateX(MathHelper.toRadians(-sqrtRotation * 80));

            // Scale down
            stack.scale.x *= 0.4;
            stack.scale.y *= 0.4;
            stack.scale.z *= 0.4;

            // Render item
            player.renderer.updateFirstPerson(player);
        } else {
            // Initial offset on screen
            this.translate(stack, -xOffset * 0.3, yOffset * 0.4, -zOffset * 0.4);
            this.translate(stack, 0.8 * factor, -0.75 * factor - (1.0 - equipProgress) * 0.6, -0.9 * factor);

            // Rotation of hand
            stack.rotateY(MathHelper.toRadians(45));
            stack.rotateY(MathHelper.toRadians(sqrtRotation * 70));
            stack.rotateZ(MathHelper.toRadians(-powRotation * 20));

            // Post transform
            this.translate(stack, -1, 3.6, 3.5);
            stack.rotateZ(MathHelper.toRadians(120));
            stack.rotateX(MathHelper.toRadians(200));
            stack.rotateY(MathHelper.toRadians(-135));
            this.translate(stack, 5.6, 0.0, 0.0);

            // Render hand
            player.renderer.renderRightHand(player, partialTicks);
        }
    }

    renderBlockHitBox(player, partialTicks) {
        // Hide block highlight when GUI is hidden (F1 toggle)
        if (GuiFunctions.isGuiHidden()) {
            this.blockHitBox.visible = false;
            return;
        }

        let hitResult = player.rayTrace(5, partialTicks);
        let hitBoxVisible = !(hitResult === null);
        this.blockHitBox.visible = hitBoxVisible;

        if (hitBoxVisible) {
            let x = hitResult.x;
            let y = hitResult.y;
            let z = hitResult.z;

            // Get block type
            let world = this.minecraft.world;
            let typeId = world.getBlockAt(x, y, z);

            if (typeId !== 0) {
                let block = Block.getById(typeId);

                // Get bounding boxes for the selection highlight
                let boxes = world.getBlockCollisionBoxesAt(x, y, z);
                if (boxes.length === 0 && block) {
                    let bbox = block.getBoundingBox(world, x, y, z);
                    if (bbox) {
                        boxes = [new BoundingBox(
                            x + bbox.minX, y + bbox.minY, z + bbox.minZ,
                            x + bbox.maxX, y + bbox.maxY, z + bbox.maxZ
                        )];
                    }
                }

                // Clear existing hit box lines
                while (this.blockHitBox.children.length > 0) {
                    this.blockHitBox.remove(this.blockHitBox.children[0]);
                }

                // Create line segments for each bounding box
                for (let bbox of boxes) {
                    let width = bbox.maxX - bbox.minX + 0.01;
                    let height = bbox.maxY - bbox.minY + 0.01;
                    let depth = bbox.maxZ - bbox.minZ + 0.01;

                    let geometry = new THREE.BoxGeometry(width, height, depth);
                    let edges = new THREE.EdgesGeometry(geometry);
                    let line = new THREE.LineSegments(edges, this.blockHitBoxMaterial);

                    line.position.set(
                        bbox.minX + (bbox.maxX - bbox.minX) / 2,
                        bbox.minY + (bbox.maxY - bbox.minY) / 2,
                        bbox.minZ + (bbox.maxZ - bbox.minZ) / 2
                    );

                    this.blockHitBox.add(line);
                }
            }
        }

        this.lastHitResult = hitResult;
    }

    updateEntityBoundingBoxes(partialTicks) {
        let show = this.minecraft.settings.showEntityBoundingBoxes;
        this.entityBBoxGroup.visible = show;

        if (!show) return;

        // Clear existing bbox lines
        while (this.entityBBoxGroup.children.length > 0) {
            this.entityBBoxGroup.remove(this.entityBBoxGroup.children[0]);
        }

        let entities = this.minecraft.world.entities;
        let player = this.minecraft.player;

        for (let entity of entities) {
            if (!entity) continue;

            // Skip player bounding box in first-person view
            if (entity === player && this.minecraft.settings.thirdPersonView === 0) {
                continue;
            }

            // Interpolate between previous and current bounding box
            let prevBB = entity.prevBoundingBox;
            let currBB = entity.boundingBox;

            let minX = prevBB.minX + (currBB.minX - prevBB.minX) * partialTicks;
            let minY = prevBB.minY + (currBB.minY - prevBB.minY) * partialTicks;
            let minZ = prevBB.minZ + (currBB.minZ - prevBB.minZ) * partialTicks;
            let maxX = prevBB.maxX + (currBB.maxX - prevBB.maxX) * partialTicks;
            let maxY = prevBB.maxY + (currBB.maxY - prevBB.maxY) * partialTicks;
            let maxZ = prevBB.maxZ + (currBB.maxZ - prevBB.maxZ) * partialTicks;

            let width = maxX - minX;
            let height = maxY - minY;
            let depth = maxZ - minZ;

            if (width <= 0 || height <= 0 || depth <= 0) continue;

            let geometry = new THREE.BoxGeometry(width, height, depth);
            let edges = new THREE.EdgesGeometry(geometry);
            let line = new THREE.LineSegments(edges, this.entityBBoxMaterial);

            line.position.set(
                minX + width / 2,
                minY + height / 2,
                minZ + depth / 2
            );

            this.entityBBoxGroup.add(line);
        }
    }

    updateBlockBreakOverlay(partialTicks) {
        let player = this.minecraft.player;
        let miningTimer = this.minecraft.miningTimer;
        let lastBlockPos = this.minecraft.lastBlockPos;

        if (player.creative || miningTimer <= 0 || lastBlockPos === null || !this.textureAtlas.isLoaded()) {
            this.blockBreakMesh.visible = false;
            return;
        }

        let x = lastBlockPos.x;
        let y = lastBlockPos.y;
        let z = lastBlockPos.z;

        let typeId = this.minecraft.world.getBlockAt(x, y, z);
        if (typeId === 0) {
            this.blockBreakMesh.visible = false;
            return;
        }

        let block = Block.getById(typeId);
        let requiredTicks = Math.max(1, Math.ceil(block.getHardness() * 30));

        let heldItem = this.minecraft.player.inventory.getItemInSelectedSlot()
        let heldTypeId = heldItem ? heldItem.getType() : null
        let heldBlock = heldTypeId ? Block.getById(heldTypeId) : null
        let tool = heldBlock instanceof ItemTool ? heldBlock : null

        let minLevel = block.minimumToolLevel()
        if (minLevel) {
            let toolMaterial = tool ? tool.material : null
            if (!toolMaterial || ItemTool.materials.indexOf(toolMaterial) < ItemTool.materials.indexOf(minLevel)) {
                requiredTicks *= 5
            }
        }

        let preferredType = block.getPreferredToolType()
        if (tool && (!preferredType || tool.toolType === preferredType)) {
            let eff = tool.efficiency() || 1
            requiredTicks = Math.ceil(requiredTicks / eff)
        } else {
            requiredTicks = Math.ceil(requiredTicks * Block.handHardnessMultiplier)
        }

        let stage = Math.min(9, Math.floor(miningTimer * 10 / requiredTicks));
        let textureName = `destroy_stage_${stage}`;
        let uvs = this.textureAtlas.getUVs(textureName);

        if (this.blockBreakMaterial.map) {
            let offsetX = uvs.minU;
            let offsetY = 1.0 - uvs.maxV;
            let repeatX = uvs.maxU - uvs.minU;
            let repeatY = uvs.maxV - uvs.minV;
            this.blockBreakMaterial.map.offset.set(offsetX, offsetY);
            this.blockBreakMaterial.map.repeat.set(repeatX, repeatY);
            this.blockBreakMaterial.map.needsUpdate = true;
        }

        let width = 1.01;
        let height = 1.01;
        let depth = 1.01;

        this.blockBreakMesh.scale.set(width, height, depth);
        this.blockBreakMesh.position.set(
            x + 0.5,
            y + 0.5,
            z + 0.5
        );
        this.blockBreakMesh.visible = true;
    }

    translate(stack, x, y, z) {
        stack.translateX(x);
        stack.translateY(y);
        stack.translateZ(z);
    }

    bobbingAnimation(player, stack, partialTicks) {
        let walked = -(player.prevDistanceWalked + (player.distanceWalked - player.prevDistanceWalked) * partialTicks);
        let yaw = player.prevCameraYaw + (player.cameraYaw - player.prevCameraYaw) * partialTicks;
        let pitch = player.prevCameraPitch + (player.cameraPitch - player.prevCameraPitch) * partialTicks;

        this.translate(
            stack,
            Math.sin(walked * 3.141593) * yaw * 0.5,
            -Math.abs(Math.cos(walked * Math.PI) * yaw),
            0.0
        );

        stack.rotateZ(MathHelper.toRadians(Math.sin(walked * Math.PI) * yaw * 3.0));
        stack.rotateX(MathHelper.toRadians(Math.abs(Math.cos(walked * Math.PI - 0.2) * yaw) * 5.0));
        stack.rotateX(MathHelper.toRadians(pitch));
    }

    reset() {
        // Remove world group from scene if it exists
        if (this.minecraft.world !== null) {
            this.scene.remove(this.minecraft.world.group);
        }

        // Clear any remaining children that might be stale, but preserve block hit box
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            const child = this.scene.children[i];
            if (child !== this.blockHitBox) {
                this.scene.remove(child);
            }
        }
        for (let i = this.background.children.length - 1; i >= 0; i--) {
            this.background.remove(this.background.children[i]);
        }
        for (let i = this.overlay.children.length - 1; i >= 0; i--) {
            const child = this.overlay.children[i];
            if (child !== this.chunkBoundaryLines && child !== this.chunkSectionLines && child !== this.blockBreakMesh) {
                this.overlay.remove(child);
            }
        }

        // Ensure block hit box is in the scene
        if (!this.scene.children.includes(this.blockHitBox)) {
            this.scene.add(this.blockHitBox);
        }
        if (!this.overlay.children.includes(this.blockBreakMesh)) {
            this.overlay.add(this.blockBreakMesh);
        }
        this.blockBreakMesh.visible = false;

        this.webRenderer.clear();
    }
}