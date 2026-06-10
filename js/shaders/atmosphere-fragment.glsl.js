// Atmosphere glow fragment shader (Fresnel effect)
export const atmosphereFragment = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

uniform vec3 uViewDirection;
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
uniform float uTime;

void main() {
  vec3 viewDir = normalize(uViewDirection - vWorldPosition);
  float fresnel = 1.0 - abs(dot(viewDir, vNormal));
  fresnel = pow(fresnel, 3.0);

  float glow = fresnel * uGlowIntensity;
  float alpha = glow * 0.7;
  alpha += fresnel * 0.15;

  // Subtle color variation
  float colorShift = sin(vPosition.y * 2.0 + uTime * 0.2) * 0.1;
  vec3 color = uGlowColor + colorShift;

  gl_FragColor = vec4(color, alpha);
}
`;
