// Wormhole tunnel vertex shader — Interstellar cinematic style
// Uses physics-based deformation from Morris-Thorne metric
export const wormholeVertex = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vRadialAngle;
varying vec3 vWorldNormal;

uniform float uTime;
uniform float uSpeed;
uniform float uTunnelLength;
uniform float uThroatCenter;
uniform float uThroatWidth;
uniform float uWallDistortion;
uniform float uLensingStrength;

void main() {
  vec3 pos = position;

  // Normalize depth: map cylinder local z to 0..1
  // CylinderGeometry along Y rotated 90° around X → local z is de facto Z
  float halfLen = uTunnelLength * 0.5;
  float depth = (pos.z + halfLen) / uTunnelLength; // 0 at near end, 1 at far end
  depth = clamp(depth, 0.0, 1.0);

  // Distance from throat center
  float distFromThroat = abs(depth - uThroatCenter);

  // ── Shape function (Morris-Thorne inspired radial deformation) ──
  float throatFactor = 1.0 - exp(-distFromThroat * distFromThroat / (2.0 * uThroatWidth * uThroatWidth));
  float radiusMul = 1.0 - throatFactor * 0.88;
  float distortionWave = sin(pos.z * 0.3 + uTime * 0.2) * uWallDistortion * (1.0 - throatFactor);

  pos.x *= (radiusMul + distortionWave);
  pos.y *= (radiusMul + distortionWave);

  // ── Spiral twist ──
  float twist = depth * 2.8 + uTime * uSpeed * 0.15;
  float ct = cos(twist), st = sin(twist);
  float ox = pos.x, oy = pos.y;
  pos.x = ox * ct - oy * st;
  pos.y = ox * st + oy * ct;

  // ── Gravitational lensing warping ──
  float lensWave = sin(depth * 12.0 + uTime * uSpeed * 0.3) * uLensingStrength * 0.06;
  pos.x += lensWave * sin(pos.y * 1.7);
  pos.y += lensWave * cos(pos.x * 1.7);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vPosition = pos;
  vUv = uv;
  vDepth = depth;
  vRadialAngle = atan(pos.y, pos.x);
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  gl_Position = projectionMatrix * mvPosition;
}
`;
