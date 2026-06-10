// Particle fragment shader
export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vProgress;

uniform float uTime;

void main() {
  // Circular soft particle
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = 1.0 - smoothstep(0.0, 1.0, d);
  alpha = pow(alpha, 1.5);
  alpha *= vAlpha;

  // Subtle core glow
  float core = 1.0 - smoothstep(0.0, 0.3, d);
  core = pow(core, 3.0) * 0.4;

  vec3 color = vColor + vec3(core * 0.5);

  gl_FragColor = vec4(color, alpha * 0.8);
}
`;
