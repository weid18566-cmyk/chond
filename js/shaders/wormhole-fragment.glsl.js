// ══════════════════════════════════════════════════════════════
//  Wormhole Tunnel Fragment Shader — Clean Physics Visualization
//  Black space + white spacetime grid + velocity-streaked stars
//  Blue-tinted entrance (Earth atmosphere) → neutral throat → gray exit (Moon)
// ══════════════════════════════════════════════════════════════
export const wormholeFragment = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vRadialAngle;
varying float vDistFromThroat;
varying float vThroatFactor;
varying float vRadiusFromCenter;

uniform float uTime;
uniform float uSpeed;
uniform float uGridDensity;
uniform float uGlowIntensity;
uniform float uTunnelLength;
uniform float uDopplerShift;
uniform float uRingIntensity;
uniform float uThroatCenter;
uniform float uThroatWidth;
uniform float uProgress;

float gaussian(float x, float sigma) {
  return exp(-x * x / (2.0 * sigma * sigma));
}

void main() {
  // ── Scrolling space-time grid ──
  float scroll = uTime * uSpeed * 3.0;
  float zGrid = vPosition.z + scroll;

  // Primary rings (space-time slices)
  float ring1 = abs(fract(zGrid * uGridDensity * 0.55) - 0.5) * 2.0;
  float ringLine = 1.0 - smoothstep(0.0, 0.04, ring1);

  // Longitudinal lines
  float longDist = abs(fract(vRadialAngle / 6.28318 * 28.0) - 0.5) * 2.0;
  float longLine = 1.0 - smoothstep(0.0, 0.02, longDist);

  // Fine rings (secondary detail)
  float fineRing = abs(fract(zGrid * uGridDensity * 4.0) - 0.5) * 2.0;
  float fineGrid = (1.0 - smoothstep(0.0, 0.015, fineRing)) * 0.3;

  float grid = max(max(ringLine, longLine), fineGrid);

  // ── Throat influence ──
  float throatInf = gaussian(vDistFromThroat, uThroatWidth * 0.7);
  // Grid bends more near throat
  float distortedRing = abs(fract(zGrid * uGridDensity * 0.55 +
    sin(vRadialAngle * 3.5 + uTime) * throatInf * 0.25) - 0.5) * 2.0;
  grid = max(grid, (1.0 - smoothstep(0.0, 0.035, distortedRing)) * 0.55 * throatInf);

  // ── Velocity-streaked stars ──
  float streak = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float streakZ = zGrid * (0.25 + fi * 0.2) + vPosition.x * 0.06;
    float sPos = fract(streakZ + fi * 0.33);
    float sWidth = 0.003 * (1.0 + abs(vDepth - uThroatCenter) * 10.0) * (1.0 + fi * 0.3);
    if (sPos < sWidth) {
      float s = 1.0 - (sPos / sWidth);
      s = pow(s, 1.8);
      streak = max(streak, s * (0.6 - fi * 0.15));
    }
  }
  streak *= (0.3 + throatInf * 0.7);

  // ── Color: subtle Earth-atmosphere → neutral → Moon gray ──
  vec3 colorEarth = vec3(0.06, 0.1, 0.22);   // deep blue-black (atmospheric scatter)
  vec3 colorThroat = vec3(0.1, 0.1, 0.12);    // neutral deep gray (singularity)
  vec3 colorMoon = vec3(0.12, 0.11, 0.1);     // warm gray (lunar surface)

  vec3 baseColor;
  float t = vDepth;
  if (t < 0.15) {
    baseColor = mix(colorEarth, vec3(0.12, 0.13, 0.2), t / 0.15);
  } else if (t < uThroatCenter - 0.05) {
    float f = (t - 0.15) / (uThroatCenter - 0.2);
    baseColor = mix(vec3(0.12, 0.13, 0.2), colorThroat, pow(f, 1.5));
  } else if (t < uThroatCenter + 0.05) {
    float f = (t - (uThroatCenter - 0.05)) / 0.1;
    baseColor = mix(colorThroat, vec3(0.11, 0.11, 0.11), f);
  } else if (t < 0.9) {
    float f = (t - (uThroatCenter + 0.05)) / (0.85 - uThroatCenter);
    baseColor = mix(vec3(0.11, 0.11, 0.11), colorMoon, pow(f, 1.3));
  } else {
    float f = (t - 0.9) / 0.1;
    baseColor = mix(colorMoon, vec3(0.13, 0.12, 0.1), f);
  }

  // ── Einstein ring (subtle bright ring at throat) ──
  float einsteinRing = gaussian(vDistFromThroat, uThroatWidth * 0.5) * uRingIntensity * 0.6;

  // ── Edge glow (subtle, structural) ──
  float edgeGlow = 1.0 - smoothstep(0.0, 1.0, vRadiusFromCenter / 7.5);
  edgeGlow = pow(edgeGlow, 2.2) * 0.2;

  // ── Event horizon darkening ──
  float farDarken = 1.0 - smoothstep(0.88, 0.98, vDepth) * 0.85;
  float nearBrighten = 0.2 + smoothstep(0.0, 0.08, vDepth) * 0.8;

  // ── Final composition ──
  float alpha = grid * uGlowIntensity * 0.95;
  alpha += streak * 0.5;
  alpha += einsteinRing * 1.0;
  alpha += edgeGlow;
  alpha *= farDarken * nearBrighten;
  alpha = clamp(alpha, 0.0, 1.0);

  vec3 finalColor = baseColor * (0.7 + grid * 0.5);
  finalColor += vec3(0.9, 0.92, 1.0) * streak * 0.35;  // white star streaks
  finalColor += vec3(0.8, 0.85, 1.0) * einsteinRing * 0.5;  // subtle ring glow
  finalColor += vec3(0.02, 0.02, 0.04);  // deep space floor

  gl_FragColor = vec4(finalColor, alpha);
}
`;
