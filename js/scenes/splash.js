// Splash Screen Scene — 3D rotating wormhole entrance with particles
import * as THREE from 'three';

export function createSplashScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);

  // ── Stars background ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 60 + Math.random() * 40;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = Math.random() * 2 + 0.5;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  const starMat = new THREE.PointsMaterial({
    color: 0xe0e8ff,
    size: 0.08,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Wormhole entrance (torus ring) ──
  const ringGroup = new THREE.Group();
  const torusGeo = new THREE.TorusGeometry(2.2, 0.12, 32, 120);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.7,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI * 0.5;
  ringGroup.add(torus);

  // Inner ring
  const innerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.06, 24, 100),
    new THREE.MeshBasicMaterial({ color: 0x7b2ff7, transparent: true, opacity: 0.6 })
  );
  innerTorus.rotation.x = Math.PI * 0.5;
  ringGroup.add(innerTorus);

  // Outer glow ring
  const outerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.04, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.3 })
  );
  outerTorus.rotation.x = Math.PI * 0.55;
  outerTorus.rotation.y = Math.PI * 0.3;
  ringGroup.add(outerTorus);

  ringGroup.position.z = -1;
  scene.add(ringGroup);

  // ── Accretion particles ──
  const particleCount = Math.floor(perf.particleBudget * 0.1);
  const particleGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);
  const pColors = new Float32Array(particleCount * 3);
  const pData = []; // store individual particle state

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2.5 + Math.random() * 3.5;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    // Color: cyan, purple, magenta mix
    const c = new THREE.Color();
    const t = Math.random();
    if (t < 0.33) c.setHex(0x00f0ff);
    else if (t < 0.66) c.setHex(0x7b2ff7);
    else c.setHex(0xff00aa);
    pColors[i * 3] = c.r;
    pColors[i * 3 + 1] = c.g;
    pColors[i * 3 + 2] = c.b;
    pData.push({ angle, dist, y: pPositions[i * 3 + 1], speed: 0.005 + Math.random() * 0.03, phase: Math.random() * Math.PI * 2 });
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  ringGroup.add(particles);

  // ── Central glow sphere ──
  const glowGeo = new THREE.SphereGeometry(0.8, 32, 32);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      void main() {
        float fresnel = 1.0 - abs(dot(normalize(vec3(0, 0, 1)), vNormal));
        fresnel = pow(fresnel, 2.5);
        float pulse = 0.7 + sin(uTime * 1.5) * 0.3;
        float alpha = fresnel * 0.6 * pulse;
        vec3 color = mix(vec3(0.0, 0.941, 1.0), vec3(0.482, 0.184, 0.969), fresnel);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSphere = new THREE.Mesh(glowGeo, glowMat);
  ringGroup.add(glowSphere);

  // ── Ambient particle field ──
  const dustCount = 500;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustData = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 20;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    dustData.push({
      vx: (Math.random() - 0.5) * 0.003,
      vy: (Math.random() - 0.5) * 0.003,
      vz: (Math.random() - 0.5) * 0.003,
    });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x8899bb,
    size: 0.03,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dustField = new THREE.Points(dustGeo, dustMat);
  scene.add(dustField);

  // ── Nebula planes ──
  const nebulaMat1 = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        float n = noise(vUv * 5.0 + uTime * 0.02);
        float neb = smoothstep(0.45, 0.55, n) * 0.08;
        float r = 0.482 + neb;
        float g = 0.1 + neb * 0.5;
        float b = 0.8 + neb;
        float alpha = neb * 0.5;
        gl_FragColor = vec4(r, g, b, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const nebula1 = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), nebulaMat1);
  nebula1.position.set(4, 2, -8);
  scene.add(nebula1);

  const nebula2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), nebulaMat1);
  nebula2.position.set(-5, -1, -6);
  scene.add(nebula2);

  // ── State ──
  let isPlaying = false;
  let transitionProgress = 0;
  let transitionCallback = null;

  // ── Trail system (for touch interaction) ──
  const trailPoints = [];
  const MAX_TRAIL = 50;
  const trailGeo = new THREE.BufferGeometry();
  const trailPositionsArr = new Float32Array(MAX_TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositionsArr, 3));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const trailLine = new THREE.Points(trailGeo, trailMat);
  scene.add(trailLine);

  // ── Render loop ──
  function animate(time) {
    requestAnimationFrame(animate);
    const t = time * 0.001;

    // Rotate wormhole
    ringGroup.rotation.z += 0.003;
    ringGroup.rotation.x = Math.sin(t * 0.2) * 0.1;
    ringGroup.rotation.y += 0.002;

    // Update accretion particles
    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const pd = pData[i];
      pd.angle += pd.speed;
      const newDist = pd.dist - pd.speed * 0.3;
      pd.dist = newDist < 0.3 ? 3.0 + Math.random() * 3.0 : newDist;
      posArr[i * 3] = Math.cos(pd.angle) * pd.dist;
      posArr[i * 3 + 1] = pd.y;
      posArr[i * 3 + 2] = Math.sin(pd.angle) * pd.dist * 0.5;
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Pulse glow
    glowMat.uniforms.uTime.value = t;
    torusMat.opacity = 0.5 + Math.sin(t * 2) * 0.2 + Math.sin(t * 3.7) * 0.1;

    // Rotate stars slowly
    stars.rotation.y += 0.0001;
    stars.rotation.x += 0.00005;

    // Dust drift
    const dustArr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const dd = dustData[i];
      dustArr[i * 3] += dd.vx;
      dustArr[i * 3 + 1] += dd.vy;
      dustArr[i * 3 + 2] += dd.vz;
      if (Math.abs(dustArr[i * 3]) > 10) dustArr[i * 3] *= -1;
      if (Math.abs(dustArr[i * 3 + 1]) > 10) dustArr[i * 3 + 1] *= -1;
      if (Math.abs(dustArr[i * 3 + 2]) > 7) dustArr[i * 3 + 2] *= -1;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // Update trail
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      trailPoints[i].life -= 0.015;
      if (trailPoints[i].life <= 0) trailPoints.splice(i, 1);
    }
    const count = Math.min(trailPoints.length, MAX_TRAIL);
    for (let i = 0; i < count; i++) {
      trailPositionsArr[i * 3] = trailPoints[i].x;
      trailPositionsArr[i * 3 + 1] = trailPoints[i].y;
      trailPositionsArr[i * 3 + 2] = trailPoints[i].z;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, count);

    // Transition zoom
    if (isPlaying && transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + 0.008);
      const ease = 1 - Math.pow(1 - transitionProgress, 3);
      camera.fov = 55 + ease * 100;
      camera.updateProjectionMatrix();
      ringGroup.scale.setScalar(1 + ease * 5);
      ringGroup.position.z = -1 - ease * 8;
      torusMat.opacity = 0.7 * (1 - ease);
      glowMat.uniforms.uTime.value = t;
      if (transitionProgress >= 1 && transitionCallback) {
        transitionCallback();
      }
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);

  // ── Public API ──
  return {
    scene,
    camera,
    renderer,

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    addTrailPoint(x, y) {
      // Convert screen coords to 3D space near the wormhole
      const ndcX = (x / window.innerWidth) * 2 - 1;
      const ndcY = -(y / window.innerHeight) * 2 + 1;
      trailPoints.push({ x: ndcX * 6, y: ndcY * 6, z: -1, life: 1 });
      if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
    },

    startTransition(callback) {
      isPlaying = true;
      transitionProgress = 0;
      transitionCallback = callback;
    },

    dispose() {
      renderer.dispose();
    },
  };
}
