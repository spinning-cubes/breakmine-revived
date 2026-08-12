// Fragment shader for chunk rendering with dynamic lighting
precision mediump float;

uniform sampler2D map;
uniform sampler3D lightTexture;
uniform vec3 chunkOffset; // World position of chunk origin
uniform float lightTextureScale; // Scale factor for light texture coordinates

varying vec2 vUv;
varying vec4 vColor;
varying vec3 vWorldPosition;

void main() {
    // Sample base texture
    vec4 texColor = texture2D(map, vUv);
    
    // Calculate light texture coordinates
    // Convert world position to light texture space
    vec3 lightUV = (vWorldPosition + chunkOffset) * lightTextureScale;
    
    // Sample dynamic light from 3D texture
    vec3 dynamicLight = texture3D(lightTexture, lightUV).rgb;
    
    // Combine vertex color with dynamic light
    vec3 finalColor = vColor.rgb * dynamicLight;
    
    gl_FragColor = vec4(finalColor, texColor.a * vColor.a);
}
