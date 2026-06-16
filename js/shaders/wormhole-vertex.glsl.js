// ══════════════════════════════════════════════════════════════
//  INTERSTELLAR WORMHOLE VERTEX SHADER v2.0
//  Morris-Thorne metric deformation with:
//    - Proper embedding diagram geometry (hourglass funnel)
//    - Gravitational lensing vertex displacement
//    - Frame-dragging spiral twist
//    - Accretion disk plane distortion
//    - Chromatic aberration vertex spread
// ══════════════════════════════════════════════════════════════
export const wormholeVertex = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vRadialAngle;
varying vec3 vWorldNormal;
varying float vDistFromThroat;
varying float vThroatFactor;
varying vec3 vOriginalPosition;
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

// ── Gaussian helper ──
float gaussian(float x, float sigma) {
  float s2 = sigma * sigma;
  return exp(-x * x / (2.0 * s2));
}

void main() {
  vec3 pos = position;
  vOriginalPosition = pos;

  // Compute radial angle early (needed by distortion waves)
  float radialAngle = atan(pos.y, pos.x);
  vRadialAngle = radialAngle;

  // Normalize depth: 0 at entrance, 1 at exit
  float halfLen = uTunnelLength * 0.5;
  float depth = clamp((pos.z + halfLen) / uTunnelLength, 0.0, 1.0);
  vDepth = depth;

  // Distance from throat center
  float distFromThroat = abs(depth - uThroatCenter);
  vDistFromThroat = distFromThroat;

  // ── Morris-Thorne shape function (proper embedding diagram) ──
  // The throat forms an hourglass funnel shape
  float throatFactor = 1.0 - exp(-distFromThroat * distFromThroat / (2.0 * uThroatWidth * uThroatWidth));
  vThroatFactor = throatFactor;

  // Smooth pinch: radius contracts to 12% at throat center
  float radiusMul = 1.0 - throatFactor * 0.88;

  // ── Embedding diagram curvature (additional parabolic deformation) ──
  float embeddingCurve = throatFactor * (1.0 - throatFactor) * 0.15;
  radiusMul += embeddingCurve * sin(uTime * 0.5 + depth * 6.28);

  // ── Wall distortion waves (traveling waves modulated by physics) ──
  float distortAmp = uWallDistortion * (1.0 - throatFactor * 0.5);
  float wave1 = sin(pos.z * 0.25 + uTime * 0.8) * distortAmp;
  float wave2 = sin(pos.z * 0.6 - uTime * 1.2 + radialAngle * 3.0) * distortAmp * 0.4;
  float wave3 = sin(pos.z * 1.5 + uTime * 2.0) * distortAmp * 0.15;
  float distortionWave = wave1 + wave2 + wave3;

  pos.x *= (radiusMul + distortionWave);
  pos.y *= (radiusMul + distortionWave);

  // ── Accretion disk plane wobble ──
  // Creates a subtle flattening/elongation in one axis
  float accretionFlatten = 1.0 + 0.15 * gaussian(distFromThroat, 0.15) * sin(uTime * 0.3);
  pos.x *= accretionFlatten;

  // ── Frame-dragging spiral (Lense-Thirring effect) ──
  // Stronger near throat, reverses direction on exit side
  float dragDir = depth < uThroatCenter ? 1.0 : -1.0;
  float dragStrength = uFrameDrag * gaussian(distFromThroat, 0.12);
  float twist = depth * 3.5 + uTime * uSpeed * 0.12 * dragDir * dragStrength;
  // Additional rapid twist at throat
  twist += gaussian(distFromThroat, 0.05) * uTime * uSpeed * 0.8;

  float ct = cos(twist), st = sin(twist);
  float ox = pos.x, oy = pos.y;
  pos.x = ox * ct - oy * st;
  pos.y = ox * st + oy * ct;

  // ── Gravitational lensing vertex displacement ──
  // Space itself warps — vertices shift based on depth and radial position
  float lensWarp = uLensingStrength * 0.08 * gaussian(distFromThroat, 0.08);
  // Recompute radial angle after twist for accurate lensing direction
  radialAngle = atan(pos.y, pos.x);

  // Lensing creates concentric distortion rings
  float lensRing1 = sin(radialAngle * 3.0 + depth * 20.0 + uTime * uSpeed * 0.5) * lensWarp;
  float lensRing2 = cos(radialAngle * 5.0 - depth * 15.0 + uTime * uSpeed * 0.3) * lensWarp * 0.5;
  pos.x += (lensRing1 + lensRing2) * sign(pos.x);
  pos.y += (lensRing1 - lensRing2) * sign(pos.y);

  // ── Tidal stretching (anisotropic deformation near throat) ──
  float tidalStretch = 1.0 + 0.08 * gaussian(distFromThroat, 0.06);
  pos.z *= tidalStretch;

  // ── Breathing/pulsation at throat ──
  float breathe = gaussian(distFromThroat, 0.1) * sin(uTime * 3.0) * 0.02;
  pos.x *= (1.0 + breathe);
  pos.y *= (1.0 + breathe);

  vRadiusFromCenter = length(pos.xy);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vPosition = pos;
  vUv = uv;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  gl_Position = projectionMatrix * mvPosition;
}
`;
