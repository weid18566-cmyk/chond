// ══════════════════════════════════════════════════════════════
//  INTERSTELLAR WORMHOLE FRAGMENT SHADER v2.0
//  Cinematic volumetric rendering with:
//    - Multi-layer scrolling grid (space-time fabric)
//    - Einstein ring with photon sphere caustics
//    - Doppler-shifted color palette (blue → white → gold)
//    - Gravitational lensing star streaks
//    - Volumetric light scattering / god rays
//    - Accretion disk energy bands
//    - Chromatic aberration near throat
//    - Event horizon darkening with soft falloff
// ══════════════════════════════════════════════════════════════
export const wormholeFragment = /* glsl */ `
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
uniform float uGridDensity;
uniform float uGlowIntensity;
uniform float uTunnelLength;
uniform float uDopplerShift;
uniform float uRingIntensity;
uniform float uLensingStrength;
uniform float uThroatCenter;
uniform float uThroatWidth;
uniform float uProgress;
uniform float uChromaticAberr;

// ── Interstellar color palette ──
const vec3 COLOR_ENTRY_DEEP    = vec3(0.05, 0.15, 0.6);   // deep blue (far Earth)
const vec3 COLOR_ENTRY         = vec3(0.0, 0.75, 1.0);    // cyan (blue-shifted)
const vec3 COLOR_PRE_THROAT    = vec3(0.4, 0.5, 1.0);    // blue-purple transition
const vec3 COLOR_THROAT        = vec3(1.0, 0.95, 0.85);   // white-hot center
const vec3 COLOR_POST_THROAT  = vec3(1.0, 0.7, 0.3);    // warm transition
const vec3 COLOR_EXIT          = vec3(1.0, 0.45, 0.08);   // gold/orange (red-shifted)
const vec3 COLOR_EXIT_DEEP     = vec3(0.6, 0.2, 0.05);   // deep amber (far Moon)

// ── Helpers ──
float gaussian(float x, float sigma) {
  return exp(-x * x / (2.0 * sigma * sigma));
}

// Hash function for pseudo-random
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  // ══════════════ SCROLLING SPACE-TIME GRID ══════════════
  float scrollOffset = uTime * uSpeed * 4.5;
  float zGrid = vPosition.z + scrollOffset;

  // Layer 1: Primary horizontal rings (space-time slices)
  float ring1 = abs(fract(zGrid * uGridDensity * 0.6) - 0.5) * 2.0;
  float ringLine1 = 1.0 - smoothstep(0.0, 0.06, ring1);

  // Layer 2: Vertical longitude lines (radial structure)
  float longLine = 1.0 - smoothstep(0.0, 0.025, abs(fract(vRadialAngle / 6.28318 * 32.0) - 0.5) * 2.0);

  // Layer 3: Fine detail grid
  float fineRing = abs(fract(zGrid * uGridDensity * 5.0) - 0.5) * 2.0;
  float fineLine = (1.0 - smoothstep(0.0, 0.015, fineRing)) * 0.25;

  // Layer 4: Ultra-fine micro-grid (near throat only)
  float microGrid = 0.0;
  float throatInf = gaussian(vDistFromThroat, uThroatWidth);
  if (throatInf > 0.01) {
    float microRing = abs(fract(zGrid * uGridDensity * 20.0) - 0.5) * 2.0;
    microGrid = (1.0 - smoothstep(0.0, 0.01, microRing)) * 0.15 * throatInf;
  }

  float grid = max(max(max(ringLine1, longLine), fineLine), microGrid);

  // ══════════════ THROAT DISTORTION ZONE ══════════════
  float throatInfluence = gaussian(vDistFromThroat, uThroatWidth * 0.8);

  // Grid warps with increasing amplitude near throat (space-time fabric ripples)
  float distortAmount = throatInfluence * 0.5;
  float distortedRing = abs(fract(
    zGrid * uGridDensity * 0.6 +
    sin(vRadialAngle * 4.0 + uTime * 1.5) * distortAmount +
    cos(vRadialAngle * 7.0 - uTime * 0.8) * distortAmount * 0.3
  ) - 0.5) * 2.0;
  float distortedGrid = (1.0 - smoothstep(0.0, 0.04, distortedRing)) * 0.7;
  grid = max(grid, distortedGrid * throatInfluence);

  // ── Caustic patterns near throat (photon paths converging) ──
  float caustic = 0.0;
  if (throatInfluence > 0.05) {
    vec2 causticUV = vec2(vRadialAngle * 4.0, zGrid * 0.15);
    float c1 = sin(causticUV.x + uTime * 2.0) * cos(causticUV.y + uTime * 1.5);
    float c2 = sin(causticUV.x * 2.3 - uTime * 1.8) * cos(causticUV.y * 1.7 + uTime * 0.7);
    caustic = (c1 * c2) * 0.5 + 0.5;
    caustic = pow(caustic, 4.0) * throatInfluence * 0.4;
  }

  // ══════════════ EINSTEIN RING (Photon Sphere) ══════════════
  // Bright ring formed by photons orbiting the throat
  float einsteinRing = gaussian(vDistFromThroat, uThroatWidth * 0.6) * uRingIntensity;
  einsteinRing = pow(einsteinRing, 1.5) * 1.2;

  // Photon sphere caustics (concentric rings of focused light)
  float photonRings = 0.0;
  float photonDist = abs(vDistFromThroat - uThroatWidth * 0.3);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ringR = abs(photonDist - fi * 0.02);
    photonRings += gaussian(ringR, 0.008) * (0.5 - fi * 0.15);
  }
  photonRings *= uRingIntensity;

  // ══════════════ COLOR PALETTE (Doppler Shift) ══════════════
  float t = vDepth;
  vec3 baseColor;

  if (t < 0.15) {
    float f = t / 0.15;
    baseColor = mix(COLOR_ENTRY_DEEP, COLOR_ENTRY, pow(f, 1.5));
  } else if (t < uThroatCenter - 0.1) {
    float f = (t - 0.15) / (uThroatCenter - 0.1 - 0.15);
    baseColor = mix(COLOR_ENTRY, COLOR_PRE_THROAT, pow(f, 1.3));
  } else if (t < uThroatCenter + 0.1) {
    float f = (t - (uThroatCenter - 0.1)) / 0.2;
    baseColor = mix(COLOR_PRE_THROAT, COLOR_THROAT, pow(f, 0.8));
  } else if (t < 0.85) {
    float f = (t - (uThroatCenter + 0.1)) / (0.85 - uThroatCenter - 0.1);
    baseColor = mix(COLOR_POST_THROAT, COLOR_EXIT, pow(f, 1.1));
  } else {
    float f = (t - 0.85) / 0.15;
    baseColor = mix(COLOR_EXIT, COLOR_EXIT_DEEP, pow(f, 1.4));
  }

  // Doppler color bias (blue/red shift)
  baseColor.r += uDopplerShift * 0.35;
  baseColor.b -= uDopplerShift * 0.35;
  baseColor.g += uDopplerShift * 0.1 * (1.0 - abs(uDopplerShift));

  // White-hot boost at throat center
  baseColor += vec3(throatInfluence * 0.15);

  // ══════════════ STREAKING STARS (Gravitational Lensing) ══════════════
  // Stars appear stretched into arcs by space-time curvature
  float streak = 0.0;
  vec3 streakColor = baseColor;

  // Multiple streak layers at different scales
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float streakZ = zGrid * (0.3 + fi * 0.25) + vPosition.x * (0.08 + fi * 0.05);
    float streakPos = fract(streakZ + fi * 0.33);
    float streakWidth = 0.004 * (1.0 + abs(vDepth - uThroatCenter) * 15.0) * (1.0 + fi * 0.3);

    if (streakPos < streakWidth) {
      float s = 1.0 - (streakPos / streakWidth);
      s = pow(s, 2.0);
      streak = max(streak, s * (0.5 - fi * 0.12));
    }
  }

  float streakBrightness = streak;
  // Streaks concentrate near throat (photon focusing)
  streakBrightness *= (0.3 + throatInfluence * 0.7);

  // Streak color shifts based on position
  streakColor = mix(COLOR_ENTRY, COLOR_THROAT, throatInfluence);

  // ══════════════ ACCRETION DISK ENERGY BANDS ══════════════
  float accretion = 0.0;
  float accRadius = vRadiusFromCenter;
  // Energy bands at specific radii
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float bandCenter = 2.0 + fi * 2.0;
    float bandWidth = 0.8 - fi * 0.15;
    float band = gaussian(accRadius - bandCenter, bandWidth) * (0.4 - fi * 0.08);
    band *= (0.5 + throatInfluence * 0.5);
    accretion += band;
  }
  accretion *= 0.6;
  vec3 accretionColor = mix(vec3(1.0, 0.8, 0.3), vec3(1.0, 0.4, 0.1), throatInfluence);

  // ══════════════ VOLUMETRIC LIGHT SCATTERING ══════════════
  // Simulates light scattering through curved space-time
  float scatter = 0.0;
  // God-ray effect from throat center
  float godRayAngle = atan(vPosition.y, vPosition.x);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ray = pow(abs(sin(godRayAngle * 3.0 + fi * 1.2566 + uTime * 0.5)), 8.0);
    ray *= gaussian(vDistFromThroat, uThroatWidth * (1.0 + fi * 0.5)) * 0.15;
    scatter += ray;
  }
  scatter *= throatInfluence * 2.0;

  // ══════════════ EDGE / DEPTH GLOW ══════════════
  float distFromCenter = vRadiusFromCenter;
  float edgeGlow = 1.0 - smoothstep(0.0, 1.0, distFromCenter / 8.0);
  edgeGlow = pow(edgeGlow, 2.5);

  // Inner edge brightening (energy concentration at throat wall)
  float innerGlow = smoothstep(0.85, 0.95, distFromCenter / (10.0 * (1.0 - vThroatFactor * 0.88))) * throatInfluence * 0.5;

  // ══════════════ EVENT HORIZON DARKENING ══════════════
  // Smooth falloff at tunnel ends — simulates looking into darkness
  float farDarken = 1.0 - smoothstep(0.88, 0.98, vDepth) * 0.9;
  float nearDarken = 1.0 - smoothstep(0.0, 0.06, vDepth) * 0.4;
  float darkening = farDarken * nearDarken;

  // ══════════════ CHROMATIC ABERRATION ══════════════
  // RGB channels shift slightly near throat
  vec3 chromaticShift = vec3(
    uChromaticAberr * (1.0 - throatInfluence),
    0.0,
    -uChromaticAberr * (1.0 - throatInfluence)
  );

  // ══════════════ FINAL COMPOSITING ══════════════
  // Layer all visual elements
  float alpha = 0.0;

  // Grid contribution
  alpha += grid * uGlowIntensity * 0.9;

  // Einstein ring and photon sphere
  alpha += max(einsteinRing * 0.9, photonRings * 0.7);

  // Star streaks
  alpha += streakBrightness * 0.6;

  // Volumetric scatter
  alpha += scatter * 0.5;

  // Accretion disk
  alpha += accretion * 0.5;

  // Caustics
  alpha += caustic * 0.4;

  // Edge glow
  alpha += edgeGlow * 0.25;

  // Inner glow
  alpha += innerGlow * 0.3;

  // Apply darkening
  alpha *= darkening;
  alpha = clamp(alpha, 0.0, 1.0);

  // ── Color composition ──
  vec3 finalColor = baseColor * (0.5 + grid * 0.8);
  finalColor += streakColor * streakBrightness * 0.6;
  finalColor += accretionColor * accretion * 0.5;
  finalColor += vec3(1.0) * (einsteinRing * 0.6 + photonRings * 0.4);  // white ring glow
  finalColor += vec3(0.8, 0.9, 1.0) * scatter * 0.3;  // cool scatter color
  finalColor += vec3(1.0) * caustic * 0.3;  // white caustics

  // Deep space ambient
  finalColor += vec3(0.01, 0.02, 0.06);

  // Throat white-hot bloom
  finalColor += vec3(throatInfluence * 0.2);

  // Chromatic aberration
  finalColor += chromaticShift;

  gl_FragColor = vec4(finalColor, alpha);
}
`;
