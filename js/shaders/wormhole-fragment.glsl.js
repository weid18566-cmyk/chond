// Wormhole tunnel fragment shader — Interstellar cinematic
// Features: blue/red shift, Einstein ring, gravitational lensing streaks,
//            depth-based color transition, volumetric glow
export const wormholeFragment = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vRadialAngle;
varying vec3 vWorldNormal;

uniform float uTime;
uniform float uSpeed;
uniform float uGridDensity;
uniform float uGlowIntensity;
uniform float uTunnelLength;
uniform float uDopplerShift;
uniform float uRingIntensity;
uniform float uLensingStrength;
uniform float uThroatCenter;
uniform float uThroatWidth;

// ── Interstellar color palette ──
const vec3 COLOR_ENTRY = vec3(0.0, 0.85, 1.0);    // cyan (blue-shifted)
const vec3 COLOR_THROAT = vec3(0.9, 0.85, 1.0);    // white-hot center
const vec3 COLOR_EXIT = vec3(1.0, 0.55, 0.15);      // gold/orange (red-shifted)

void main() {
  // ── Scrolling grid ──
  float scrollOffset = uTime * uSpeed * 4.0;
  float zGrid = vPosition.z + scrollOffset;

  // Horizontal rings
  float ring = abs(fract(zGrid * uGridDensity * 0.7) - 0.5) * 2.0;
  float ringLine = 1.0 - smoothstep(0.0, 0.05, ring);

  // Vertical longitude lines
  float longLine = 1.0 - smoothstep(0.0, 0.03, abs(fract(vRadialAngle / 6.28318 * 24.0) - 0.5) * 2.0);

  // Fine grid
  float fineRing = abs(fract(zGrid * uGridDensity * 4.5) - 0.5) * 2.0;
  float fineLine = (1.0 - smoothstep(0.0, 0.02, fineRing)) * 0.35;

  float grid = max(max(ringLine, longLine), fineLine);

  // ── Distorted area near throat ──
  float distThroat = abs(vDepth - uThroatCenter);
  float throatInfluence = exp(-distThroat * distThroat / (uThroatWidth * uThroatWidth * 4.0));

  // Grid distortion increases near throat
  float distortedRing = abs(fract(zGrid * uGridDensity * 0.7 + sin(vRadialAngle * 3.0 + uTime) * throatInfluence * 0.3) - 0.5) * 2.0;
  float distortedGrid = (1.0 - smoothstep(0.0, 0.05, distortedRing)) * 0.6;
  grid = max(grid, distortedGrid * throatInfluence);

  // ── Einstein ring effect (bright ring near throat) ──
  float ringGlow = exp(-distThroat * distThroat * 120.0) * uRingIntensity;
  grid = max(grid, ringGlow * 0.8);

  // ── Color shift with depth ──
  float t = vDepth;
  vec3 baseColor;
  if (t < uThroatCenter) {
    float f = t / uThroatCenter;
    baseColor = mix(COLOR_ENTRY, COLOR_THROAT, pow(f, 1.2));
  } else {
    float f = (t - uThroatCenter) / (1.0 - uThroatCenter);
    baseColor = mix(COLOR_THROAT, COLOR_EXIT, pow(f, 0.8));
  }

  // Doppler shift color bias
  baseColor.r += uDopplerShift * 0.3;
  baseColor.b -= uDopplerShift * 0.3;

  // ── Streaking stars (elongated by lensing) ──
  float streak = 0.0;
  float streakZ = zGrid * 0.5 + vPosition.x * 0.1;
  float streakPos = fract(streakZ);
  float streakWidth = 0.006 * (1.0 + abs(vDepth - uThroatCenter) * 12.0);
  if (streakPos < streakWidth) {
    streak = 1.0 - (streakPos / streakWidth);
  }
  float streakBrightness = streak * 0.55;
  // Streaks are brighter near throat
  streakBrightness *= (0.4 + throatInfluence * 0.6);

  // ── Edge/distance glow ──
  float distFromCenter = length(vPosition.xy);
  float edgeGlow = 1.0 - smoothstep(0.0, 1.0, distFromCenter / 7.0);
  edgeGlow = pow(edgeGlow, 2.2);

  // ── Event horizon darkening ──
  float farDarken = 1.0 - smoothstep(0.88, 0.96, vDepth) * 0.8;
  float nearDarken = 1.0 - smoothstep(0.0, 0.04, vDepth) * 0.3;

  // ── Combine ──
  float alpha = max(max(grid * uGlowIntensity, streakBrightness), edgeGlow * 0.3);
  alpha *= farDarken * nearDarken;
  alpha = clamp(alpha, 0.0, 1.0);

  // Final color composition
  vec3 finalColor = baseColor * (0.65 + grid * 0.7 + streakBrightness * 0.5);
  finalColor += vec3(0.02, 0.03, 0.08); // deep space ambient
  finalColor += vec3(throatInfluence * 0.1); // white hot at throat

  gl_FragColor = vec4(finalColor, alpha);
}
`;
