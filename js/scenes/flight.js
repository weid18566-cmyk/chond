// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR WORMHOLE FLIGHT SCENE v2.0                              ║
// ║  Earth → Moon traversal with cinematic Morris-Thorne physics           ║
// ║  Features:                                                            ║
// ║    - Multi-layer tunnel (inner surface + energy streams + filaments)  ║
// ║    - Accretion disk particle ring                                      ║
// ║    - Gravitational lensing star field                                  ║
// ║    - Event horizon spheres (Earth/Moon portal)                         ║
// ║    - Energy filament system                                            ║
// ║    - Camera FOV breathing & dynamic exposure                           ║
// ║    - Cinematic letterbox bars                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';
import { wormholeVertex } from '../shaders/wormhole-vertex.glsl.js';
import { wormholeFragment } from '../shaders/wormhole-fragment.glsl.js';
import { createWormholePhysics, WORMHOLE_DB } from '../utils/physics.js';

export function createFlightScene(canvas, perf) {
  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020408);
  scene.fog = new THREE.FogExp2(0x020408, 0.00006);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 0);

  // ── Physics Engine ──
  const physics = createWormholePhysics();

  // ── Tunnel Parameters ──
  const tunnelLength = 300;
  const tunnelRadius = 12;
  const gridDetail = perf.gridDetail;

  // ══════════════ MAIN TUNNEL ══════════════
  const tunnelGeo = new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelLength, 96, gridDetail, true);
  const tunnelUniforms = {
    uTime:              { value: 0 },
    uSpeed:             { value: 0 },
    uTunnelLength:      { value: tunnelLength },
    uGridDensity:       { value: 0.55 },
    uGlowIntensity:     { value: perf.bloomStrength },
    uDopplerShift:      { value: 0 },
    uRingIntensity:     { value: 0.4 },
    uLensingStrength:   { value: 2.0 },
    uThroatCenter:      { value: WORMHOLE_DB.throatPosition },
    uThroatWidth:       { value: WORMHOLE_DB.throatWidth },
    uWallDistortion:    { value: 0 },
    uFrameDrag:         { value: WORMHOLE_DB.frameDragStrength },
    uProgress:          { value: 0 },
    uChromaticAberr:    { value: 0 },
  };
  const tunnelMat = new THREE.ShaderMaterial({
    vertexShader: wormholeVertex,
    fragmentShader: wormholeFragment,
    uniforms: tunnelUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: true,
  });
  const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
  tunnel.rotation.x = Math.PI * 0.5;
  tunnel.position.z = -tunnelLength * 0.5;
  scene.add(tunnel);

  // ══════════════ INNER ENERGY LAYER (smaller, brighter) ══════════════
  const innerRadius = tunnelRadius * 0.6;
  const innerGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, tunnelLength, 64, Math.floor(gridDetail * 0.6), true);
  const innerUniforms = {
    uTime: tunnelUniforms.uTime,
    uSpeed: tunnelUniforms.uSpeed,
    uTunnelLength: { value: tunnelLength },
    uGridDensity: { value: 1.2 },
    uGlowIntensity: { value: perf.bloomStrength * 0.4 },
    uDopplerShift: tunnelUniforms.uDopplerShift,
    uRingIntensity: { value: 0.2 },
    uLensingStrength: { value: 1.2 },
    uThroatCenter: tunnelUniforms.uThroatCenter,
    uThroatWidth: { value: WORMHOLE_DB.throatWidth * 1.5 },
    uWallDistortion: tunnelUniforms.uWallDistortion,
    uFrameDrag: tunnelUniforms.uFrameDrag,
    uProgress: tunnelUniforms.uProgress,
    uChromaticAberr: tunnelUniforms.uChromaticAberr,
  };
  const innerMat = new THREE.ShaderMaterial({
    vertexShader: wormholeVertex,
    fragmentShader: wormholeFragment,
    uniforms: innerUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const innerTunnel = new THREE.Mesh(innerGeo, innerMat);
  innerTunnel.rotation.x = Math.PI * 0.5;
  innerTunnel.position.z = -tunnelLength * 0.5;
  scene.add(innerTunnel);

  // ══════════════ ACCRETION DISK PARTICLE RING ══════════════
  const diskParticleCount = perf.tier === 'high' ? 15000 : perf.tier === 'medium' ? 6000 : 2000;
  const diskGeo = new THREE.BufferGeometry();
  const diskPos = new Float32Array(diskParticleCount * 3);
  const diskCol = new Float32Array(diskParticleCount * 3);
  const diskSizes = new Float32Array(diskParticleCount);
  const diskData = []; // orbital data

  for (let i = 0; i < diskParticleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 8;
    const z = (Math.random() - 0.5) * 1.5 * (1 - Math.exp(-r * 0.3)); // thin disk
    diskPos[i * 3] = Math.cos(angle) * r;
    diskPos[i * 3 + 1] = z;
    diskPos[i * 3 + 2] = Math.sin(angle) * r;

    // Color: hot inner → cool outer
    const temp = 1 - (r - 1.5) / 8;
    const c = new THREE.Color();
    c.setHSL(0.08 + temp * 0.05, 0.8 + temp * 0.2, 0.3 + temp * 0.5);
    diskCol[i * 3] = c.r; diskCol[i * 3 + 1] = c.g; diskCol[i * 3 + 2] = c.b;
    diskSizes[i] = 0.02 + Math.random() * 0.06;

    diskData.push({
      angle, radius: r,
      speed: 0.3 / Math.max(r, 0.5), // Kepler-like orbital speed
      zOffset: z,
      phase: Math.random() * Math.PI * 2,
    });
  }

  diskGeo.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
  diskGeo.setAttribute('color', new THREE.BufferAttribute(diskCol, 3));
  diskGeo.setAttribute('aSize', new THREE.BufferAttribute(diskSizes, 1));

  // Accretion disk shader
  const diskMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: tunnelUniforms.uTime,
      uBrightness: { value: 0.8 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute vec3 color; attribute float aSize;
      varying vec3 vColor; varying float vAlpha;
      uniform float uTime;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        gl_PointSize = clamp(aSize * (150.0 / max(dist, 0.1)), 0.5, 4.0);
        vAlpha = smoothstep(200.0, 20.0, dist) * 0.7;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      uniform float uOpacity; uniform float uBrightness;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0) * vAlpha * uOpacity * uBrightness;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const diskParticles = new THREE.Points(diskGeo, diskMat);
  // Place disk at throat position
  const throatZ = -tunnelLength * WORMHOLE_DB.throatPosition;
  diskParticles.position.z = throatZ;
  scene.add(diskParticles);

  // ══════════════ MAIN PARTICLE STREAM ══════════════
  const pCount = perf.particleBudget;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  const pSizes = new Float32Array(pCount);
  const pPhases = new Float32Array(pCount); // random phase for variation

  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * (tunnelRadius - 0.5);
    const z = -Math.random() * tunnelLength;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = Math.sin(angle) * dist;
    pPositions[i * 3 + 2] = z;

    // Multi-zone color gradient
    const ct = -z / tunnelLength;
    const c = new THREE.Color();
    if (ct < 0.2) c.setRGB(0.05, 0.3, 0.8);       // deep blue
    else if (ct < 0.4) c.setRGB(0.0, 0.7, 1.0);    // cyan
    else if (ct < 0.5) c.setRGB(0.5, 0.6, 1.0);    // blue-purple
    else if (ct < 0.6) c.setRGB(0.95, 0.9, 0.85);  // white-hot
    else if (ct < 0.75) c.setRGB(1.0, 0.7, 0.3);   // warm gold
    else if (ct < 0.9) c.setRGB(1.0, 0.45, 0.08);  // orange
    else c.setRGB(0.6, 0.2, 0.05);                  // deep amber

    pColors[i * 3] = c.r; pColors[i * 3 + 1] = c.g; pColors[i * 3 + 2] = c.b;
    pSizes[i] = Math.random() * 0.25 + 0.02;
    pPhases[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhases, 1));

  const pUniforms = { uTime: { value: 0 }, uSpeed: { value: 0 }, uTunnelLength: { value: tunnelLength } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms,
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aSize; attribute float aPhase;
      varying vec3 vColor; varying float vAlpha;
      uniform float uTime, uSpeed, uTunnelLength;

      float gaussian(float x, float sigma) {
        return exp(-x * x / (2.0 * sigma * sigma));
      }

      void main() {
        vec3 pos = position;

        // Scroll through tunnel
        float zNew = mod(pos.z - uTime * uSpeed * 5.0, -uTunnelLength);
        pos.z = zNew;

        float df = -pos.z / uTunnelLength; // 0=entrance, 1=exit
        float distFromThroat = abs(df - 0.5);

        // Morris-Thorne radial pinch
        float throatFactor = 1.0 - exp(-distFromThroat * distFromThroat / 0.015);
        float rm = 1.0 - throatFactor * 0.88;
        pos.x *= rm; pos.y *= rm;

        // Frame-dragging twist
        float dragDir = df < 0.5 ? 1.0 : -1.0;
        float dragStr = gaussian(distFromThroat, 0.1) * 0.4;
        float tw = df * 3.5 + uTime * uSpeed * 0.5 * dragDir * dragStr;
        tw += gaussian(distFromThroat, 0.04) * uTime * uSpeed * 0.8;
        float ox = pos.x, oy = pos.y;
        pos.x = ox * cos(tw) - oy * sin(tw);
        pos.y = ox * sin(tw) + oy * cos(tw);

        // Random wobble from phase
        pos.x += sin(uTime * 2.0 + aPhase) * 0.1 * gaussian(distFromThroat, 0.15);
        pos.y += cos(uTime * 1.5 + aPhase * 1.3) * 0.1 * gaussian(distFromThroat, 0.15);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        float dist = -mv.z;

        // Size varies: larger near throat (gravitational lensing magnification)
        float sizeMultiplier = 1.0 + gaussian(distFromThroat, 0.06) * 2.0;
        gl_PointSize = clamp(aSize * sizeMultiplier * (180.0 / max(dist, 0.1)), 0.25, 9.0);

        // Alpha: fade at extremes, bright at throat
        vAlpha = 1.0 - smoothstep(0.92, 1.0, df);
        vAlpha *= (0.4 + gaussian(distFromThroat, 0.1) * 0.6);

        vColor = color;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.8) * vAlpha * 0.8;
        // Soft glow halo
        float halo = pow(1.0 - smoothstep(0.3, 1.0, d), 3.0) * 0.15 * vAlpha;
        gl_FragColor = vec4(vColor * (1.0 + halo * 2.0), a + halo);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particleSystem = new THREE.Points(pGeo, pMat);
  scene.add(particleSystem);

  // ══════════════ ENERGY FILAMENTS ══════════════
  // Bright streaks of energy flowing along the tunnel
  const filamentCount = perf.tier === 'high' ? 40 : perf.tier === 'medium' ? 20 : 10;
  const filaments = [];
  const filamentGroup = new THREE.Group();
  filamentGroup.position.z = -tunnelLength * 0.5;

  for (let i = 0; i < filamentCount; i++) {
    const points = [];
    const segments = 60;
    const angle = (i / filamentCount) * Math.PI * 2;
    const radiusOffset = 3 + Math.random() * 6;
    const spiralFreq = 1 + Math.random() * 2;

    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const z = (t - 0.5) * tunnelLength;
      const r = radiusOffset * (1 - 0.88 * (1 - Math.exp(-Math.pow(t - 0.5, 2) / 0.006)));
      const twist = t * spiralFreq * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle + twist) * r,
        Math.sin(angle + twist) * r,
        z
      ));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, segments * 2, 0.03 + Math.random() * 0.04, 4, false);
    const tubeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: tunnelUniforms.uTime,
        uColor: { value: new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.8, 0.6) },
        uOpacity: { value: 0.3 + Math.random() * 0.3 },
      },
      vertexShader: `
        varying vec2 vUv; uniform float uTime;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
        void main() {
          // Pulsing energy flow
          float pulse = 0.5 + 0.5 * sin(vUv.x * 30.0 - uTime * 5.0);
          float a = pulse * uOpacity * (1.0 - abs(vUv.y - 0.5) * 2.0);
          gl_FragColor = vec4(uColor * (0.8 + pulse * 0.5), a);
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const filament = new THREE.Mesh(tubeGeo, tubeMat);
    filamentGroup.add(filament);
    filaments.push({ mesh: filament, baseAngle: angle, spiralFreq, radiusOffset });
  }
  scene.add(filamentGroup);

  // ══════════════ ENTRANCE / EXIT RINGS ══════════════
  // Enhanced with multiple concentric rings
  function createPortalRings(z, color, side) {
    const group = new THREE.Group();
    const rings = [
      { radius: tunnelRadius, tube: 0.25, color, opacity: 0.7 },
      { radius: tunnelRadius * 1.02, tube: 0.1, color, opacity: 0.4 },
      { radius: tunnelRadius * 0.95, tube: 0.15, color, opacity: 0.3 },
    ];
    rings.forEach(r => {
      const geo = new THREE.TorusGeometry(r.radius, r.tube, 24, 160);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(r.color) },
          uAlpha: { value: r.opacity },
          uTime: tunnelUniforms.uTime,
        },
        vertexShader: `
          varying vec2 vUv; varying vec3 vPos;
          void main() { vUv = uv; vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec2 vUv; varying vec3 vPos;
          uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
          void main() {
            float pulse = 0.7 + 0.3 * sin(vUv.x * 6.28318 * 2.0 + uTime * 3.0);
            float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
            gl_FragColor = vec4(uColor * pulse, edgeFade * uAlpha);
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.baseAlpha = r.opacity;
      group.add(mesh);
    });
    group.position.z = z;
    group.rotation.x = side === 'entrance' ? Math.PI * 0.5 : -Math.PI * 0.5;
    return group;
  }

  const entrancePortal = createPortalRings(2, 0x00aaff, 'entrance');
  scene.add(entrancePortal);

  const exitPortal = createPortalRings(-tunnelLength * 0.48, 0xff8800, 'exit');
  exitPortal.scale.set(0.15, 0.15, 1);
  scene.add(exitPortal);

  // ══════════════ EVENT HORIZON SPHERES (Portal Orbs) ══════════════
  // Glowing spheres at entrance and exit — like the Interstellar wormhole portals
  function createPortalOrb(z, color) {
    const orbGroup = new THREE.Group();

    // Core sphere
    const coreGeo = new THREE.SphereGeometry(1.5, 48, 48);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: tunnelUniforms.uTime,
        uColor1: { value: new THREE.Color(color) },
        uColor2: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vPos;
        void main() {
          vN = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vN; varying vec3 vPos;
        uniform float uTime; uniform vec3 uColor1; uniform vec3 uColor2;
        void main() {
          vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
          float fresnel = pow(1.0 - abs(dot(viewDir, vN)), 3.0);
          float pulse = 0.7 + 0.3 * sin(uTime * 2.0);
          vec3 col = mix(uColor2 * 0.3, uColor1, fresnel) * pulse;
          float a = fresnel * 0.8 + 0.1;
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(core);

    // Outer glow ring (accretion halo)
    const haloGeo = new THREE.TorusGeometry(2.0, 0.4, 16, 96);
    const haloMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI * 0.5;
    orbGroup.add(halo);

    orbGroup.position.z = z;
    return orbGroup;
  }

  const entranceOrb = createPortalOrb(8, 0x0088ff);
  scene.add(entranceOrb);
  const exitOrb = createPortalOrb(-tunnelLength * 0.45, 0xff6600);
  exitOrb.scale.setScalar(0.2);
  scene.add(exitOrb);

  // ══════════════ GRAVITATIONAL LENSING STARFIELD ══════════════
  // Stars that appear to move/shift based on gravity (not just rotate)
  const starCount = perf.tier === 'high' ? 4000 : perf.tier === 'medium' ? 2500 : 1200;
  const starGeo = new THREE.BufferGeometry();
  const starPosArr = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starOriginalPos = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 100 + Math.random() * 80;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    starPosArr[i * 3] = x; starPosArr[i * 3 + 1] = y; starPosArr[i * 3 + 2] = z;
    starOriginalPos[i * 3] = x; starOriginalPos[i * 3 + 1] = y; starOriginalPos[i * 3 + 2] = z;
    starSizes[i] = 0.05 + Math.random() * 0.2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelUniforms.uTime, uLensing: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      uniform float uTime; uniform float uLensing;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        // Gravitational lensing: shift stars toward throat center
        float dist = length(pos.xy);
        vec2 dir = normalize(pos.xy + vec2(0.001));
        pos.xy += dir * uLensing * 5.0 / max(dist, 1.0);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (80.0 / max(-mv.z, 0.1)), 0.3, 3.0) * (1.0 + uLensing);
        vAlpha = 0.6 + uLensing * 0.3;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.5) * vAlpha;
        gl_FragColor = vec4(vec3(0.9, 0.92, 1.0), a);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ══════════════ EARTH SKY / MOON SKY BACKGROUNDS ══════════════
  const earthSkyGeo = new THREE.SphereGeometry(120, 48, 48);
  const earthSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.5 } },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform float uTime; uniform float uAlpha;
      void main() {
        float h = vPos.y / 120.0;
        float alpha = smoothstep(0.1, 0.7, h) * uAlpha;
        vec3 sky = mix(vec3(0.03, 0.08, 0.25), vec3(0.01, 0.03, 0.15), smoothstep(0.2, 0.5, h));
        // Nebula hints
        float nebula = sin(vPos.x * 0.05 + uTime * 0.1) * sin(vPos.z * 0.03) * 0.03;
        sky += vec3(0.05, 0.02, 0.1) * nebula;
        gl_FragColor = vec4(sky, alpha);
      }
    `,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const earthSky = new THREE.Mesh(earthSkyGeo, earthSkyMat);
  scene.add(earthSky);

  const moonSkyGeo = new THREE.SphereGeometry(120, 48, 48);
  const moonSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform float uTime; uniform float uAlpha;
      void main() {
        float a = smoothstep(0.1, 0.5, -vPos.y / 120.0) * uAlpha;
        vec3 sky = vec3(0.08, 0.06, 0.04);
        float nebula = sin(vPos.x * 0.04 - uTime * 0.08) * 0.02;
        sky += vec3(0.1, 0.05, 0.02) * nebula;
        gl_FragColor = vec4(sky, a);
      }
    `,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const moonSky = new THREE.Mesh(moonSkyGeo, moonSkyMat);
  scene.add(moonSky);

  // ══════════════ STATE ══════════════
  let baseSpeed = 1.6;
  let currentSpeed = baseSpeed;
  let targetSpeed = baseSpeed;
  let isBoosting = false;
  let boostTimer = null;
  let traveled = 0;
  const totalDistance = 384400;
  let isArriving = false;
  let arriveCallback = null;
  let arriveProgress = 0;
  let gyroEnabled = false;
  let gyroBeta = 0, gyroGamma = 0;
  let targetYaw = 0, targetPitch = 0;
  let currentYaw = 0, currentPitch = 0;
  let currentRoll = 0, targetRoll = 0;
  let pointerDown = false;
  let lastPointerX = 0, lastPointerY = 0;
  let elapsedTime = 0;

  // ══════════════ GYROSCOPE ══════════════
  function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(s => {
        if (s === 'granted') { gyroEnabled = true; window.addEventListener('deviceorientation', od); }
      }).catch(() => {});
    } else if ('ondeviceorientation' in window) {
      gyroEnabled = true;
      window.addEventListener('deviceorientation', od);
    }
  }
  function od(e) {
    if (!gyroEnabled) return;
    gyroBeta = e.beta || 0; gyroGamma = e.gamma || 0;
    targetPitch = (gyroGamma / 90) * 0.25;
    targetYaw = (gyroBeta / 180) * 0.3;
    targetRoll = (e.alpha || 0) * 0.001;
  }

  // ══════════════ UPDATE ══════════════
  function update(dt) {
    elapsedTime += dt;

    if (isArriving) {
      arriveProgress = Math.min(1, arriveProgress + dt * 0.5);
      currentSpeed = baseSpeed * (1 - arriveProgress);
      if (arriveProgress >= 1 && arriveCallback) { arriveCallback(); arriveCallback = null; }
    }

    currentSpeed += (targetSpeed - currentSpeed) * 3 * dt;
    traveled += currentSpeed * 8000 * dt;
    const progress = Math.min(traveled / totalDistance, 1);

    // ── Physics Evaluation ──
    const phys = physics.evaluate(progress);

    // ── Camera rotation ──
    if (gyroEnabled) {
      currentPitch += (targetPitch - currentPitch) * 5 * dt;
      currentYaw += (targetYaw - currentYaw) * 5 * dt;
    } else {
      const t = performance.now() * 0.001;
      const shake = phys.shake;
      // Organic drift with tidal response
      targetPitch = Math.sin(t * 0.25) * 0.08 + Math.sin(t * 7.3) * shake + Math.cos(t * 3.1) * shake * 0.5;
      targetYaw = Math.cos(t * 0.22) * 0.06 + Math.cos(t * 5.7) * shake;
      targetRoll = Math.sin(t * 0.18) * 0.03 + phys.frameDrag * 0.5;
      currentPitch += (targetPitch - currentPitch) * 2 * dt;
      currentYaw += (targetYaw - currentYaw) * 2 * dt;
      currentRoll += (targetRoll - currentRoll) * 1.5 * dt;
    }
    camera.rotation.set(currentPitch, currentYaw, currentRoll);

    // ── Dynamic FOV (breathing effect — narrows at throat for claustrophobia) ──
    const throatFOVBoost = phys.inThroat ? 12 : 0;
    const speedFOVBoost = currentSpeed * 3;
    const targetFOV = 75 + throatFOVBoost + speedFOVBoost * (isBoosting ? 1.5 : 1.0);
    camera.fov += (targetFOV - camera.fov) * 2 * dt;
    camera.updateProjectionMatrix();

    // ── Dynamic exposure (brighter at throat) ──
    const targetExposure = 1.3 + phys.photonSphere * 0.8 + (isBoosting ? 0.4 : 0);
    renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * 3 * dt;

    // ── Update tunnel shader uniforms ──
    const now = performance.now() * 0.001;
    tunnelUniforms.uTime.value = now;
    tunnelUniforms.uSpeed.value = currentSpeed * phys.speedMul;
    tunnelUniforms.uDopplerShift.value = phys.doppler;
    tunnelUniforms.uRingIntensity.value = phys.ringIntensity;
    tunnelUniforms.uLensingStrength.value = phys.lensing;
    tunnelUniforms.uWallDistortion.value = phys.wallDistortion;
    tunnelUniforms.uProgress.value = progress;
    tunnelUniforms.uChromaticAberr.value = phys.chromaticAberration;

    // Boost glow
    const targetGlow = isBoosting ? perf.bloomStrength * 2.5 : perf.bloomStrength;
    tunnelUniforms.uGlowIntensity.value += (targetGlow - tunnelUniforms.uGlowIntensity.value) * 4 * dt;

    // Inner tunnel sync
    innerUniforms.uWallDistortion.value = phys.wallDistortion * 1.3;

    // Particle stream
    pUniforms.uTime.value = now;
    pUniforms.uSpeed.value = currentSpeed * phys.speedMul;

    // ── Update accretion disk particles ──
    const dPos = diskGeo.attributes.position.array;
    for (let i = 0; i < diskParticleCount; i++) {
      const dd = diskData[i];
      dd.angle += dd.speed * currentSpeed * phys.speedMul * dt;
      const r = dd.radius * (1 + 0.05 * Math.sin(now * 2 + dd.phase));
      dPos[i * 3] = Math.cos(dd.angle) * r;
      dPos[i * 3 + 2] = Math.sin(dd.angle) * r;
      dPos[i * 3 + 1] = dd.zOffset * (1 + 0.3 * Math.sin(now * 3 + dd.phase));
    }
    diskGeo.attributes.position.needsUpdate = true;
    diskMat.uniforms.uBrightness.value = 0.6 + phys.accretionBrightness * 0.8;

    // Accretion disk visibility: fades in near throat
    const diskAlpha = smoothstep_local(0.25, 0.45, progress) * (1 - smoothstep_local(0.55, 0.75, progress));
    diskParticles.visible = diskAlpha > 0.01;
    diskMat.uniforms.uOpacity.value = diskAlpha;

    // ── Energy filament pulse ──
    filaments.forEach(f => {
      f.mesh.material.uniforms.uOpacity.value =
        (0.2 + 0.3 * phys.volumetricScatter) * (0.5 + 0.5 * Math.sin(now * 2 + f.baseAngle));
    });

    // ── Background sky transitions ──
    const earthAlpha = (1 - smoothstep_local(0.05, 0.3, progress)) * 0.5;
    const moonAlpha = smoothstep_local(0.7, 0.95, progress) * 0.5;
    earthSkyMat.uniforms.uAlpha.value = earthAlpha;
    moonSkyMat.uniforms.uAlpha.value = moonAlpha;

    // ── Entrance / Exit portals ──
    const entranceFade = Math.max(0, 1 - progress * 5);
    entrancePortal.children.forEach(c => {
      if (c.material.uniforms) c.material.uniforms.uAlpha.value = entranceFade * (c.userData.baseAlpha || 1);
    });
    const exitScale = smoothstep_local(0.6, 0.95, progress);
    exitPortal.scale.set(0.15 + exitScale * 0.85, 0.15 + exitScale * 0.85, 1);

    // Portal orbs
    entranceOrb.scale.setScalar(Math.max(0, 1 - progress * 4));
    exitOrb.scale.setScalar(smoothstep_local(0.7, 0.95, progress));

    // ── Gravitational lensing on starfield ──
    starMat.uniforms.uLensing.value = phys.lensing * 0.5;
    starField.rotation.z += 0.00015 * currentSpeed;
    starField.rotation.y += 0.0001 * currentSpeed;

    // ── Render ──
    renderer.render(scene, camera);
    return { progress, phys };
  }

  function smoothstep_local(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // ══════════════ INPUT ══════════════
  function onPointerDown(e) {
    pointerDown = true;
    lastPointerX = e.clientX || e.touches?.[0]?.clientX || 0;
    lastPointerY = e.clientY || e.touches?.[0]?.clientY || 0;
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    targetYaw += (cx - lastPointerX) * 0.002;
    targetPitch += (cy - lastPointerY) * 0.002;
    targetPitch = Math.max(-0.4, Math.min(0.4, targetPitch));
    targetYaw = Math.max(-0.5, Math.min(0.5, targetYaw));
    lastPointerX = cx; lastPointerY = cy;
  }
  function onPointerUp() { pointerDown = false; }

  function triggerBoost() {
    if (isBoosting) return;
    isBoosting = true; targetSpeed = baseSpeed * 2.8;
    if (boostTimer) clearTimeout(boostTimer);
    boostTimer = setTimeout(() => { isBoosting = false; targetSpeed = baseSpeed; }, 2800);
  }
  function endBoost() {
    if (boostTimer) clearTimeout(boostTimer);
    isBoosting = false; targetSpeed = baseSpeed;
  }

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    start() { traveled = 0; targetSpeed = baseSpeed; enableGyro(); },
    update,
    physics,
    getProgress() { return Math.min(traveled / totalDistance, 1); },
    getTraveled() { return traveled; },
    getTotalDistance() { return totalDistance; },
    getPhys() { return physics.evaluate(Math.min(traveled / totalDistance, 1)); },
    startArrival(cb) { isArriving = true; arriveCallback = cb; arriveProgress = 0; },
    triggerBoost,
    isBoostActive() { return isBoosting; },
    setBaseSpeed(s) { baseSpeed = s; if (!isBoosting) targetSpeed = s; },
    getSpeed() { return currentSpeed; },
    onPointerDown, onPointerMove, onPointerUp,
    dispose() {
      if (boostTimer) { clearTimeout(boostTimer); boostTimer = null; }
      renderer.dispose();
      window.removeEventListener('deviceorientation', od);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
}
