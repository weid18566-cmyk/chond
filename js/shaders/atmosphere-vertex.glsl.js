// Atmosphere glow vertex shader (planet)
export const atmosphereVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
