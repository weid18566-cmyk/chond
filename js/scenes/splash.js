// Splash Screen Scene — 3D rotating wormhole entrance with particles (fixed rAF)
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

  // ── Stars ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 60 + Math.random() * 40;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xe0e8ff, size: 0.08, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(stars);

  // ── Wormhole rings ──
  const ringGroup = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.12, 32, 120),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 })
  );
  torus.rotation.x = Math.PI * 0.5;
  ringGroup.add(torus);

  const innerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.06, 24, 100),
    new THREE.MeshBasicMaterial({ color: 0x7b2ff7, transparent: true, opacity: 0.6 })
  );
  innerTorus.rotation.x = Math.PI * 0.5;
  ringGroup.add(innerTorus);

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
  const particleCount = Math.floor(perf.particleBudget * 0.08);
  const particleGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);
  const pColors = new Float32Array(particleCount * 3);
  const pData = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2.5 + Math.random() * 3.5;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    const c = new THREE.Color();
    const ct = Math.random();
    if (ct < 0.33) c.setHex(0x00f0ff);
    else if (ct < 0.66) c.setHex(0x7b2ff7);
    else c.setHex(0xff00aa);
    pColors[i * 3] = c.r; pColors[i * 3 + 1] = c.g; pColors[i * 3 + 2] = c.b;
    pData.push({ angle, dist, y: pPositions[i * 3 + 1], speed: 0.005 + Math.random() * 0.03 });
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ringGroup.add(particles);

  // ── Central glow ──
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; uniform float uTime;
      void main(){ float f=pow(1.0-abs(dot(normalize(vec3(0,0,1)),vN)),2.5);
      float p=0.7+sin(uTime*1.5)*0.3;
      gl_FragColor=vec4(mix(vec3(0,0.941,1),vec3(0.482,0.184,0.969),f),f*0.6*p); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), glowMat);
  ringGroup.add(glowSphere);

  // ── Dust field ──
  const dustCount = 500;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustData = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 20;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    dustData.push({ vx: (Math.random() - 0.5) * 0.003, vy: (Math.random() - 0.5) * 0.003, vz: (Math.random() - 0.5) * 0.003 });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustField = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x8899bb, size: 0.03, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(dustField);

  // ── Trail system ──
  const trailPoints = [];
  const MAX_TRAIL = 50;
  const trailGeo = new THREE.BufferGeometry();
  const trailPosArr = new Float32Array(MAX_TRAIL * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPosArr, 3));
  trailGeo.setDrawRange(0, 0);
  const trailLine = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    color: 0x00f0ff, size: 0.05, transparent: true, opacity: 0.6,
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

    ringGroup.rotation.z += 0.003;
    ringGroup.rotation.x = Math.sin(t * 0.2) * 0.1;
    ringGroup.rotation.y += 0.002;

    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const pd = pData[i];
      pd.angle += pd.speed;
      const nd = pd.dist - pd.speed * 0.3;
      pd.dist = nd < 0.3 ? 3.0 + Math.random() * 3.0 : nd;
      posArr[i * 3] = Math.cos(pd.angle) * pd.dist;
      posArr[i * 3 + 1] = pd.y;
      posArr[i * 3 + 2] = Math.sin(pd.angle) * pd.dist * 0.5;
    }
    particleGeo.attributes.position.needsUpdate = true;

    glowMat.uniforms.uTime.value = t;
    torus.material.opacity = 0.5 + Math.sin(t * 2) * 0.2 + Math.sin(t * 3.7) * 0.1;

    stars.rotation.y += 0.0001;
    stars.rotation.x += 0.00005;

    const dustArr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const dd = dustData[i];
      dustArr[i * 3] += dd.vx; dustArr[i * 3 + 1] += dd.vy; dustArr[i * 3 + 2] += dd.vz;
      if (Math.abs(dustArr[i * 3]) > 10) dustArr[i * 3] *= -1;
      if (Math.abs(dustArr[i * 3 + 1]) > 10) dustArr[i * 3 + 1] *= -1;
      if (Math.abs(dustArr[i * 3 + 2]) > 7) dustArr[i * 3 + 2] *= -1;
    }
    dustGeo.attributes.position.needsUpdate = true;

    for (let i = trailPoints.length - 1; i >= 0; i--) { trailPoints[i].life -= 0.015; if (trailPoints[i].life <= 0) trailPoints.splice(i, 1); }
    const tc = Math.min(trailPoints.length, MAX_TRAIL);
    for (let i = 0; i < tc; i++) { trailPosArr[i * 3] = trailPoints[i].x; trailPosArr[i * 3 + 1] = trailPoints[i].y; trailPosArr[i * 3 + 2] = trailPoints[i].z; }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, tc);

    if (isPlaying && transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + 0.008);
      const ease = 1 - Math.pow(1 - transitionProgress, 3);
      camera.fov = 55 + ease * 100;
      camera.updateProjectionMatrix();
      ringGroup.scale.setScalar(1 + ease * 5);
      ringGroup.position.z = -1 - ease * 8;
      torus.material.opacity = 0.7 * (1 - ease);
      if (transitionProgress >= 1 && transitionCallback) { transitionCallback(); transitionCallback = null; }
    }

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(animate);

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    addTrailPoint(x, y) {
      const ndcX = (x / window.innerWidth) * 2 - 1;
      const ndcY = -(y / window.innerHeight) * 2 + 1;
      trailPoints.push({ x: ndcX * 6, y: ndcY * 6, z: -1, life: 1 });
      if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
    },
    startTransition(cb) { isPlaying = true; transitionProgress = 0; transitionCallback = cb; },
    dispose() {
      stopped = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      renderer.dispose();
      // Clean up all geometry/materials to prevent memory leaks
      scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); } });
    },
  };
}
