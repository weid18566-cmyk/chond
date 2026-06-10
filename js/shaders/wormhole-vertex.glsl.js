// Wormhole tunnel vertex shader
// Creates funnel deformation and passes data to fragment shader
export const wormholeVertex = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vViewZ;

uniform float uTime;
uniform float uSpeed;
uniform float uTunnelLength;

void main() {
  vec3 pos = position;

  // Map cylinder local z (which runs -halfLength to +halfLength along Y for CylinderGeometry,
  // but after mesh rotation it maps to our world Z axis)
  // Normalize to 0..1 range
  float depthFactor = (pos.z - (-uTunnelLength * 0.5)) / uTunnelLength;
  depthFactor = clamp(depthFactor, 0.0, 1.0);

  // Funnel deformation: narrow as we go deeper into tunnel
  float radiusMultiplier = 1.0 - depthFactor * 0.85;
  float wave = sin(pos.z * 0.5 + uTime * 0.3) * 0.05 * (1.0 - depthFactor);

  pos.x *= (radiusMultiplier + wave);
  pos.y *= (radiusMultiplier + wave);

  // Subtle spiral twist
  float twist = (0.3 + depthFactor * 1.2) + uTime * uSpeed * 0.12;
  float cosT = cos(twist);
  float sinT = sin(twist);
  float tx = pos.x * cosT - pos.y * sinT;
  float ty = pos.x * sinT + pos.y * cosT;
  pos.x = tx;
  pos.y = ty;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  vPosition = pos;
  vUv = uv;
  vDepth = depthFactor;
  vViewZ = -mvPosition.z; // view-space depth

  gl_Position = projectionMatrix * mvPosition;
}
`;
