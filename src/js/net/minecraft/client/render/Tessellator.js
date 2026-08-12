import * as THREE from "../../../../../../libraries/three.module.js";

export default class Tessellator {

    constructor(useDynamicLighting = false) {
        this.useDynamicLighting = useDynamicLighting;
        
        if (useDynamicLighting) {
            // Use custom shader material for dynamic lighting
            this.material = new THREE.ShaderMaterial({
                uniforms: {
                    map: { value: null },
                    lightTexture: { value: null },
                    chunkOffset: { value: new THREE.Vector3(0, 0, 0) },
                    lightTextureScale: { value: 1.0 }
                },
                vertexShader: `
                    attribute vec3 position;
                    attribute vec2 uv;
                    attribute vec4 color;
                    
                    uniform mat4 modelViewMatrix;
                    uniform mat4 projectionMatrix;
                    
                    varying vec2 vUv;
                    varying vec4 vColor;
                    varying vec3 vWorldPosition;
                    
                    void main() {
                        vUv = uv;
                        vColor = color;
                        vWorldPosition = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    precision mediump float;
                    
                    uniform sampler2D map;
                    uniform sampler3D lightTexture;
                    uniform vec3 chunkOffset;
                    uniform float lightTextureScale;
                    
                    varying vec2 vUv;
                    varying vec4 vColor;
                    varying vec3 vWorldPosition;
                    
                    void main() {
                        vec4 texColor = texture2D(map, vUv);
                        
                        // Calculate light texture coordinates
                        vec3 lightUV = (vWorldPosition + chunkOffset) * lightTextureScale;
                        
                        // Sample dynamic light from 3D texture
                        vec3 dynamicLight = texture3D(lightTexture, lightUV).rgb;
                        
                        // Combine vertex color with dynamic light
                        vec3 finalColor = vColor.rgb * dynamicLight;
                        
                        gl_FragColor = vec4(finalColor, texColor.a * vColor.a);
                    }
                `,
                side: THREE.FrontSide,
                transparent: true,
                depthTest: true,
                depthWrite: true
            });
        } else {
            // Use basic material for backward compatibility
            this.material = new THREE.MeshBasicMaterial({
                side: THREE.FrontSide,
                transparent: true,
                depthTest: true,
                depthWrite: true,
                vertexColors: true
            });
        }

        this.red = 0;
        this.green = 0;
        this.blue = 0;
        this.alpha = 0;

        this.baseRed = 0;
        this.baseGreen = 0;
        this.baseBlue = 0;
        this.baseAlpha = 1;

        this.rotationPivot = null;
        this.rotationFace = null;
    }

    bindTexture(texture) {
        if (this.useDynamicLighting) {
            this.material.uniforms.map.value = texture;
        } else {
            this.material.map = texture;
        }
    }

    setLightTexture(lightTexture) {
        if (this.useDynamicLighting) {
            this.material.uniforms.lightTexture.value = lightTexture;
        }
    }

    setChunkOffset(x, y, z) {
        if (this.useDynamicLighting) {
            this.material.uniforms.chunkOffset.value.set(x, y, z);
        }
    }

    setLightTextureScale(scale) {
        if (this.useDynamicLighting) {
            this.material.uniforms.lightTextureScale.value = scale;
        }
    }

    startDrawing() {
        this.addedVertices = 0;
        this.vertices = [];
        this.uv = [];
        this.colors = [];
        this.clearRotation();
    }

    // TODO: Use in the game for better FPS
    setDepthWrite(value) {
        //this.material.depthWrite = value;
    }

    setRenderingPass(isTransparent) {
        this.material.transparent = isTransparent;
        this.material.depthWrite = !isTransparent;
        // Reset cutout each pass; blocks that need it (e.g. embedded dust
        // rendered inside a solid lever) opt back in while drawing.
        this.material.alphaTest = 0;
    }

    setColorRGB(red, green, blue) {
        this.red = red;
        this.green = green;
        this.blue = blue;
    }

    setColor(red, green, blue, alpha = 1) {
        this.baseRed = red;
        this.baseGreen = green;
        this.baseBlue = blue;
        this.baseAlpha = alpha;
        this.setColorRGB(red, green, blue);
        this.setAlpha(alpha);
    }

    // Apply a directional shading factor to the current base color.
    // Unlike setColor, this does NOT replace the base color, so multiple
    // polygons can shade independently without compounding.
    setColorShaded(shading) {
        this.setColorRGB(
            this.baseRed * shading,
            this.baseGreen * shading,
            this.baseBlue * shading
        );
        this.setAlpha(this.baseAlpha);
    }

    multiplyColor(red, green, blue, alpha = 1) {
        this.red *= red;
        this.green *= green;
        this.blue *= blue;
        this.alpha *= alpha;
    }

    setAlpha(alpha) {
        this.alpha = alpha;
    }

    addVertex(x, y, z) {
        this.addedVertices++;

        // Apply the active block-model rotation before pushing the vertex
        if (this.rotationPivot !== null) {
            let rotated = this.rotate(x, y, z);
            x = rotated[0];
            y = rotated[1];
            z = rotated[2];
        }

        // Add vertex
        this.vertices.push(x);
        this.vertices.push(y);
        this.vertices.push(z);

        // Add colors
        this.colors.push(this.red);
        this.colors.push(this.green);
        this.colors.push(this.blue);
        this.colors.push(this.alpha);
    }

    // Rotate a model so it mounts on one of the six block faces. The model is
    // authored in "floor" orientation (base against the -Y face, handle
    // pointing +Y); with a pivot at the block center, rotating around it keeps
    // the base flush against the selected face.
    setRotation(pivotX, pivotY, pivotZ, faceIndex) {
        this.rotationPivot = [pivotX, pivotY, pivotZ];
        this.rotationFace = faceIndex;
    }

    clearRotation() {
        this.rotationPivot = null;
        this.rotationFace = null;
    }

    // Rotate a vertex around the active pivot. faceIndex maps to the face the
    // model is mounted on:
    //   0 = floor   (base -Y, handle +Y)
    //   1 = ceiling (base +Y, handle -Y)
    //   2 = north   (base -Z, handle +Z)
    //   3 = south   (base +Z, handle -Z)
    //   4 = west    (base -X, handle +X)
    //   5 = east    (base +X, handle -X)
    rotate(x, y, z) {
        let dx = x - this.rotationPivot[0];
        let dy = y - this.rotationPivot[1];
        let dz = z - this.rotationPivot[2];

        let rx, ry, rz;
        switch (this.rotationFace) {
            case 1:
                rx = dx; ry = -dy; rz = -dz;
                break;
            case 2:
                rx = dx; ry = -dz; rz = dy;
                break;
            case 3:
                rx = dx; ry = dz; rz = -dy;
                break;
            case 4:
                rx = dy; ry = -dx; rz = dz;
                break;
            case 5:
                rx = -dy; ry = dx; rz = dz;
                break;
            default:
                rx = dx; ry = dy; rz = dz;
                break;
        }

        return [rx + this.rotationPivot[0], ry + this.rotationPivot[1], rz + this.rotationPivot[2]];
    }

    addVertexWithUV(x, y, z, u, v) {
        this.addVertex(x, y, z);

        // Add UV
        this.uv.push(u);
        this.uv.push(v);
    }

    transformBrightness(brightness) {
        for (let i = 0; i < this.colors.length / 4; i++) {
            this.colors[i * 4 + 0] *= brightness;
            this.colors[i * 4 + 1] *= brightness;
            this.colors[i * 4 + 2] *= brightness;
        }
    }

    draw(group, inThing = false) {
        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.vertices), 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.colors), 4));
        if (this.uv.length > 0) {
            geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
        }

        // Create index array
        let index = [];
        let verticesPerFace = 4;
        for (let i = 0; i < this.addedVertices / verticesPerFace; i++) {
            index.push(i * verticesPerFace + 0);
            index.push(i * verticesPerFace + 2);
            index.push(i * verticesPerFace + 1);
            index.push(i * verticesPerFace + 0);
            index.push(i * verticesPerFace + 3);
            index.push(i * verticesPerFace + 2);
        }
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));

        // Compute bounding sphere so Three.js knows the exact geometric center for depth sorting
        geometry.computeBoundingSphere();

        // Clone the material so opaque and translucent passes maintain separate states
        let mesh = new THREE.Mesh(geometry, this.material.clone());
        if (!inThing) group.matrixAutoUpdate = false;
        group.add(mesh);
        return mesh;
    }

    finishDrawing() {
        return this.draw();
    }

}