// Vertex shader for chunk rendering with dynamic lighting
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
