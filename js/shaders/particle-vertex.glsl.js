// Particle vertex shader for wormhole tunnel
export const particleVertex = /* glsl */ `
attribute vec3 color;
attribute float aSize;
varying vec3 vColor;
varying float vAlpha;

uniform float uTime;
uniform float uSpeed;
uniform float uTunnelLength;

void main() {
  vec3 pos = position;

  float zOffset = uTime * uSpeed * 4.0;
  // mod with negative divisor wraps correctly: particles recycle
  float zNew = mod(pos.z - zOffset, -uTunnelLength);
  pos.z = zNew;

  float depthFactor = -pos.z / uTunnelLength;
  depthFactor = clamp(depthFactor, 0.0, 1.0);
  float radiusMul = 1.0 - depthFactor * 0.85;
  pos.x *= radiusMul;
  pos.y *= radiusMul;

  float twist = depthFactor * 2.5 + uTime * uSpeed * 0.5;
  float ct = cos(twist);
  float st = sin(twist);
  float oldX = pos.x;
  float oldY = pos.y;
  pos.x = oldX * ct - oldY * st;
  pos.y = oldX * st + oldY * ct;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (180.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 0.3, 6.0);

  vAlpha = 1.0 - smoothstep(0.85, 1.0, depthFactor);
  vColor = color;

  gl_Position = projectionMatrix * mvPosition;
}
`;
