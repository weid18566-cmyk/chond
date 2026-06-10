// Wormhole tunnel fragment shader
// Renders glowing grid lines with depth-based color shift and time-scrolling
export const wormholeFragment = /* glsl */ `
varying vec3 vPosition;
varying vec2 vUv;
varying float vDepth;
varying float vViewZ;

uniform float uTime;
uniform float uSpeed;
uniform float uGridDensity;
uniform float uGlowIntensity;
uniform float uTunnelLength;

// Color palette
const vec3 COLOR_CYAN = vec3(0.0, 0.941, 1.0);
const vec3 COLOR_PURPLE = vec3(0.482, 0.184, 0.969);
const vec3 COLOR_MAGENTA = vec3(1.0, 0.0, 0.667);

void main() {
  // ── Scrolling grid offset ──
  float scrollOffset = uTime * uSpeed * 3.5;

  // Use local z (in mesh space) with scroll for grid movement
  float zForGrid = vPosition.z + scrollOffset;

  // ── Grid Lines ──
  // Horizontal rings (latitude lines) — they scroll past the viewer
  float ringDist = abs(fract(zForGrid * uGridDensity * 0.6) - 0.5) * 2.0;
  float ringLine = 1.0 - smoothstep(0.0, 0.06, ringDist);

  // Vertical lines (longitude) — stationary but twist
  float angle = atan(vPosition.y, vPosition.x);
  float lineDist = abs(fract(angle / 6.28318 * 20.0) - 0.5) * 2.0;
  float longLine = 1.0 - smoothstep(0.0, 0.035, lineDist);

  // Fine secondary rings
  float fineRing = abs(fract(zForGrid * uGridDensity * 3.5) - 0.5) * 2.0;
  float fineLine = 1.0 - smoothstep(0.0, 0.025, fineRing);
  fineLine *= 0.4;

  float grid = max(max(ringLine, longLine), fineLine);

  // ── Depth-based color shift (blue shift near, red shift far) ──
  // vDepth is based on mesh-local position
  float t = pow(vDepth, 1.5);

  vec3 baseColor = mix(COLOR_CYAN, COLOR_PURPLE, clamp(t * 1.8, 0.0, 1.0));
  baseColor = mix(baseColor, COLOR_MAGENTA, smoothstep(0.6, 0.95, t) * 0.6);

  // ── Light streaks (stretched stars flowing through) ──
  float streak = 0.0;
  float streakZ = zForGrid * 0.4 + vPosition.x * 0.12;
  float streakPos = fract(streakZ);
  float streakWidth = 0.008 * (1.0 + vDepth * 6.0);
  if (streakPos < streakWidth) {
    streak = 1.0 - (streakPos / streakWidth);
  }
  streak *= 0.5 * (0.4 + vDepth * 0.6);

  // ── Edge/distance glow ──
  float distFromCenter = length(vPosition.xy);
  float edgeGlow = 1.0 - smoothstep(0.0, 1.0, distFromCenter / 7.5);
  edgeGlow = pow(edgeGlow, 2.5);
  grid = max(grid, edgeGlow * 0.45);

  // ── Darken far regions (event horizon) ──
  float farDarken = 1.0 - smoothstep(0.82, 1.0, vDepth) * 0.75;

  // ── Combine ──
  float alpha = max(grid * uGlowIntensity, streak);
  alpha *= farDarken;
  alpha = clamp(alpha, 0.0, 1.0);

  // Final color
  vec3 finalColor = baseColor * (0.75 + grid * 0.6 + streak * 0.5);
  finalColor += COLOR_CYAN * streak * 0.35;
  finalColor += vec3(0.02, 0.02, 0.06); // subtle ambient

  gl_FragColor = vec4(finalColor, alpha);
}
`;
