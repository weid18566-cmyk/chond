// ══════════════════════════════════════════════════════════════
//  Wormhole Tunnel Vertex Shader — Clean Morris-Thorne Geometry
//  Funnel deformation, spiral twist, subtle gravitational ripple
// ══════════════════════════════════════════════════════════════
export const wormholeVertex = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vRadialAngle;
varying float vDistFromThroat;
varying float vThroatFactor;
varying float vRadiusFromCenter;

uniform float uTime;
uniform float uSpeed;
uniform float uTunnelLength;
uniform float uThroatCenter;
uniform float uThroatWidth;
uniform float uWallDistortion;
uniform float uLensingStrength;
uniform float uFrameDrag;
uniform float uProgress;

void main() {
  vec3 pos = position;
  float halfLen = uTunnelLength * 0.5;
  float depth = clamp((pos.z + halfLen) / uTunnelLength, 0.0, 1.0);
  vDepth = depth;

  float distFromThroat = abs(depth - uThroatCenter);
  vDistFromThroat = distFromThroat;

  // Morris-Thorne shape: funnel pinch at throat
  float throatFactor = 1.0 - exp(-distFromThroat * distFromThroat / (2.0 * uThroatWidth * uThroatWidth));
  vThroatFactor = throatFactor;
  float radiusMul = 1.0 - throatFactor * 0.88;

  // Subtle wall ripple (structural, not flashy)
  float ripple = sin(pos.z * 0.18 + uTime * 0.4) * uWallDistortion * 0.3 * (1.0 - throatFactor);
  pos.x *= (radiusMul + ripple);
  pos.y *= (radiusMul + ripple);

  // Spiral twist (frame-dragging simulation)
  float twist = depth * 2.8 + uTime * uSpeed * 0.08;
  float ct = cos(twist), st = sin(twist);
  float ox = pos.x, oy = pos.y;
  pos.x = ox * ct - oy * st;
  pos.y = ox * st + oy * ct;

  // Gravitational lensing: subtle vertex pull toward center
  float lensPull = uLensingStrength * 0.02 * exp(-distFromThroat * distFromThroat / 0.008);
  float pullDir = length(pos.xy) > 0.01 ? 1.0 / max(length(pos.xy), 0.1) : 0.0;
  pos.x -= pos.x * lensPull * pullDir * 2.0;
  pos.y -= pos.y * lensPull * pullDir * 2.0;

  vRadialAngle = atan(pos.y, pos.x);
  vRadiusFromCenter = length(pos.xy);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vPosition = pos;
  vUv = uv;

  gl_Position = projectionMatrix * mvPosition;
}
`;
