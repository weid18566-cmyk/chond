// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR SPLASH SCREEN v2.0                                      ║
// ║  3D wormhole entrance with enhanced particles, nebula backdrop,       ║
// ║  accretion ring animation, and cinematic camera pull-back            ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';

export function createSplashScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  // ── Deep star field ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 70 + Math.random() * 50;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.03 + Math.random() * 0.15;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize; uniform float uTime;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + aSize * 10.0) + position.x * 0.1);
        gl_PointSize = aSize * twinkle * (80.0 / max(-mv.z, 0.1));
        vTwinkle = twinkle;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.5) * vTwinkle;
        gl_FragColor = vec4(vec3(0.85, 0.88, 1.0), a);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Wormhole portal group ──
  const ringGroup = new THREE.Group();

  // Main event horizon ring
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.15, 32, 140),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x00f0ff) } },
      vertexShader: `
        varying vec2 vUv; varying vec3 vPos;
        void main() { vUv = uv; vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv; varying vec3 vPos;
        uniform float uTime; uniform vec3 uColor;
        void main() {
          float pulse = 0.6 + 0.4 * sin(vUv.x * 6.28318 * 3.0 + uTime * 2.5);
          float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float a = pulse * edge * 0.8;
          gl_FragColor = vec4(uColor * pulse, a);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  torus.rotation.x = Math.PI * 0.5;
  ringGroup.add(torus);

  // Inner accretion ring
  const innerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.08, 24, 120),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7b2ff7) } },
      vertexShader: torus.material.vertexShader,
      fragmentShader: `
        varying vec2 vUv; varying vec3 vPos;
        uniform float uTime; uniform vec3 uColor;
        void main() {
          float pulse = 0.5 + 0.5 * sin(vUv.x * 6.28318 * 5.0 - uTime * 3.0);
          float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
          gl_FragColor = vec4(uColor, pulse * edge * 0.7);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  innerTorus.rotation.x = Math.PI * 0.5;
  ringGroup.add(innerTorus);

  // Outer gravitational halo
  const outerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.05, 16, 120),
    new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.25 })
  );
  outerTorus.rotation.x = Math.PI * 0.55;
  outerTorus.rotation.y = Math.PI * 0.3;
  ringGroup.add(outerTorus);

  // Second outer ring ( tilted differently for visual complexity)
  const outerTorus2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.03, 12, 100),
    new THREE.MeshBasicMaterial({ color: 0x5533aa, transparent: true, opacity: 0.15 })
  );
  outerTorus2.rotation.x = Math.PI * 0.35;
  outerTorus2.rotation.z = Math.PI * 0.5;
  ringGroup.add(outerTorus2);

  ringGroup.position.z = -2;
  scene.add(ringGroup);

  // ── Central singularity glow (enhanced) ──
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vPos;
      void main() {
        vN = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vPos;
      uniform float uTime;
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vec3(0, 0, 1)), vN)), 2.8);
        float pulse = 0.65 + sin(uTime * 1.2) * 0.2 + sin(uTime * 2.8) * 0.1 + sin(uTime * 4.3) * 0.05;
        // Color gradient: cyan center → purple edges → magenta rim
        vec3 col = mix(vec3(0.0, 0.94, 1.0), vec3(0.48, 0.18, 0.97), fresnel);
        col = mix(col, vec3(1.0, 0.0, 0.67), pow(fresnel, 3.0) * 0.3);
        float a = fresnel * 0.55 * pulse;
        // Inner bright core
        float core = pow(1.0 - fresnel, 5.0) * 0.15;
        a += core;
        col += vec3(1.0) * core;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 48), glowMat);
  ringGroup.add(glowSphere);

  // ── Accretion particles (orbiting infall) ──
  const particleCount = Math.floor(perf.particleBudget * 0.1);
  const particleGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);
  const pColors = new Float32Array(particleCount * 3);
  const pData = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1.8 + Math.random() * 4.0;
    const ySpread = (Math.random() - 0.5) * 0.8;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = ySpread;
    pPositions[i * 3 + 2] = Math.sin(angle) * dist * 0.6; // flatten to disk
    const c = new THREE.Color();
    const ct = Math.random();
    if (ct < 0.3) c.setHSL(0.52, 0.9, 0.5);       // cyan
    else if (ct < 0.6) c.setHSL(0.75, 0.8, 0.45);   // purple
    else if (ct < 0.85) c.setHSL(0.9, 0.9, 0.5);    // magenta
    else c.setHSL(0.08, 0.9, 0.6);                   // warm gold
    pColors[i * 3] = c.r; pColors[i * 3 + 1] = c.g; pColors[i * 3 + 2] = c.b;
    pData.push({
      angle, dist, y: pPositions[i * 3 + 1],
      speed: 0.004 + Math.random() * 0.025,
      yDrift: (Math.random() - 0.5) * 0.003,
    });
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ringGroup.add(particles);

  // ── Nebula dust field ──
  const dustCount = 600;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustData = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 25;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 25;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    dustData.push({
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      vz: (Math.random() - 0.5) * 0.002,
    });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustField = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x667799, size: 0.035, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(dustField);

  // ── Trail system ──
  const trailPoints = [];
  const MAX_TRAIL = 60;
  const trailGeo = new THREE.BufferGeometry();
  const trailPosArr = new Float32Array(MAX_TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPosArr, 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    color: 0x00f0ff, size: 0.04, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(trailLine);

  // ── Transition state ──
  let isPlaying = false;
  let transitionProgress = 0;
  let transitionCallback = null;

  // ── rAF management ──
  let rafId = null;
  let stopped = false;

  function animate(time) {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const t = time * 0.001;

    // Slow majestic rotation
    ringGroup.rotation.z += 0.002;
    ringGroup.rotation.x = Math.sin(t * 0.15) * 0.12;
    ringGroup.rotation.y += 0.0015;

    // ── Update accretion particles ──
    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const pd = pData[i];
      pd.angle += pd.speed;
      const nd = pd.dist - pd.speed * 0.25;
      pd.dist = nd < 0.4 ? 2.5 + Math.random() * 3.5 : nd;
      pd.y += pd.yDrift;
      if (Math.abs(pd.y) > 0.8) pd.yDrift *= -1;
      posArr[i * 3] = Math.cos(pd.angle) * pd.dist;
      posArr[i * 3 + 1] = pd.y;
      posArr[i * 3 + 2] = Math.sin(pd.angle) * pd.dist * 0.6;
    }
    particleGeo.attributes.position.needsUpdate = true;

    // ── Shader uniforms ──
    glowMat.uniforms.uTime.value = t;
    torus.material.uniforms.uTime.value = t;
    innerTorus.material.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;

    // ── Stars ──
    stars.rotation.y += 0.00008;
    stars.rotation.x += 0.00003;

    // ── Dust field drift ──
    const dArr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const dd = dustData[i];
      dArr[i * 3] += dd.vx; dArr[i * 3 + 1] += dd.vy; dArr[i * 3 + 2] += dd.vz;
      if (Math.abs(dArr[i * 3]) > 12) dArr[i * 3] *= -1;
      if (Math.abs(dArr[i * 3 + 1]) > 12) dArr[i * 3 + 1] *= -1;
      if (Math.abs(dArr[i * 3 + 2]) > 9) dArr[i * 3 + 2] *= -1;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // ── Trail particles ──
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      trailPoints[i].life -= 0.012;
      if (trailPoints[i].life <= 0) trailPoints.splice(i, 1);
    }
    const tc = Math.min(trailPoints.length, MAX_TRAIL);
    for (let i = 0; i < tc; i++) {
      trailPosArr[i * 3] = trailPoints[i].x;
      trailPosArr[i * 3 + 1] = trailPoints[i].y;
      trailPosArr[i * 3 + 2] = trailPoints[i].z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, tc);

    // ── Transition animation ──
    if (isPlaying && transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + 0.006);
      const ease = 1 - Math.pow(1 - transitionProgress, 3.5);

      // Camera zooms into wormhole (FOV expands = zoom in effect)
      camera.fov = 55 + ease * 85;
      camera.updateProjectionMatrix();

      // Ring group scales up as we "enter"
      ringGroup.scale.setScalar(1 + ease * 5);
      ringGroup.position.z = -2 - ease * 8;

      // Fade out elements
      torus.material.uniforms.uColor.value.setHSL(0.52, 0.9, 0.5 + ease * 0.5);
      innerTorus.material.uniforms.uColor.value.setHSL(0.75, 0.8, 0.45 + ease * 0.5);

      // Exposure increases for white-out effect
      renderer.toneMappingExposure = 1.15 + ease * 2;

      if (transitionProgress >= 1 && transitionCallback) {
        transitionCallback();
        transitionCallback = null;
      }
    }

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(animate);

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    addTrailPoint(x, y) {
      const ndcX = (x / window.innerWidth) * 2 - 1;
      const ndcY = -(y / window.innerHeight) * 2 + 1;
      trailPoints.push({ x: ndcX * 7, y: ndcY * 7, z: -2, life: 1 });
      if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
    },
    startTransition(cb) { isPlaying = true; transitionProgress = 0; transitionCallback = cb; },
    dispose() {
      stopped = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      renderer.dispose();
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}
