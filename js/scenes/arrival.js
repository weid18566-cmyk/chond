// Arrival Scene — Moon surface landing (Point B)
import * as THREE from 'three';

export function createArrivalScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 1.5, 10);
  camera.lookAt(0, 0, 0);

  // ── Moon Surface Group ──
  const moonGroup = new THREE.Group();
  scene.add(moonGroup);

  // Moon sphere
  const moonGeo = new THREE.SphereGeometry(2.5, 80, 80);
  const moonTexture = createMoonTexture();
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTexture,
    roughness: 0.85,
    metalness: 0.05,
    color: 0xcccccc,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moon);

  // ── Atmosphere (thin, subtle) ──
  const atmoGeo = new THREE.SphereGeometry(2.65, 64, 64);
  const atmoUniforms = {
    uViewDirection: { value: new THREE.Vector3() },
    uGlowColor: { value: new THREE.Color(0xffaa66) },
    uGlowIntensity: { value: 0.4 },
    uTime: { value: 0 },
  };
  const atmoVShader = `varying vec3 vN; varying vec3 vWP;
    void main(){ vN=normalize(mat3(modelMatrix)*normal); vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const atmoFShader = `varying vec3 vN; varying vec3 vWP;
    uniform vec3 uViewDirection; uniform vec3 uGlowColor; uniform float uGlowIntensity; uniform float uTime;
    void main(){ vec3 vd=normalize(uViewDirection-vWP); float f=pow(1.0-abs(dot(vd,vN)),3.5);
    gl_FragColor=vec4(uGlowColor,f*uGlowIntensity*0.5); }`;
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: atmoVShader, fragmentShader: atmoFShader,
    uniforms: atmoUniforms,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  moonGroup.add(atmosphere);

  // ── Crater details (surface bumps via displacement-like particles) ──
  const craterCount = 200;
  const craterGeo = new THREE.BufferGeometry();
  const craterPos = new Float32Array(craterCount * 3);
  for (let i = 0; i < craterCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = 2.52;
    craterPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    craterPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    craterPos[i * 3 + 2] = r * Math.cos(phi);
  }
  craterGeo.setAttribute('position', new THREE.BufferAttribute(craterPos, 3));
  const craters = new THREE.Points(craterGeo, new THREE.PointsMaterial({
    color: 0x333333, size: 0.06, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  moonGroup.add(craters);

  // ── Star field (Milky Way feel, no atmosphere so very bright) ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount * 1.5;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 60 + Math.random() * 50;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.1, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(stars);

  // ── Distant Earth (blue dot) ──
  const earthGeo = new THREE.SphereGeometry(0.3, 32, 32);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; uniform float uTime;
      void main(){ float f=1.0-abs(dot(normalize(vec3(1,0.3,0)),vN));
      vec3 c=mix(vec3(0.2,0.5,1.0),vec3(0.05,0.15,0.5),f);
      gl_FragColor=vec4(c,1.0); }`,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.position.set(8, 3, -15);
  scene.add(earth);

  // Earth atmosphere
  const earthAtmo = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: atmoVShader, fragmentShader: `varying vec3 vN; varying vec3 vWP;
      uniform float uTime;
      void main(){ float f=pow(1.0-abs(dot(normalize(vec3(8,3,-15)-vWP),vN)),3.0);
      gl_FragColor=vec4(vec3(0.2,0.6,1.0),f*0.4); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  earthAtmo.position.copy(earth.position);
  scene.add(earthAtmo);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight(0x111122, 0.6));
  const sun = new THREE.DirectionalLight(0xffeedd, 4);
  sun.position.set(10, 5, 5);
  scene.add(sun);

  // ── Animation ──
  let rafId = null;
  let stopped = false;

  function animate(time) {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const t = time * 0.001;

    moon.rotation.y += 0.0015;
    atmosphere.rotation.y -= 0.0008;
    atmosphere.rotation.x += 0.0004;
    stars.rotation.y += 0.0001;
    stars.rotation.x += 0.00005;
    craters.rotation.y += 0.0015;

    const cd = new THREE.Vector3();
    camera.getWorldDirection(cd);
    atmoUniforms.uViewDirection.value.copy(camera.position);
    atmoUniforms.uTime.value = t;
    earth.rotation.y += 0.002;
    earthMat.uniforms.uTime.value = t;

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  // ── Interaction ──
  let isDragging = false, prevP = { x: 0, y: 0 };
  let rotVel = { x: 0, y: 0 };
  let targetZoom = 1, currentZoom = 1;
  let touchStartDist = 0;

  function getPos(e) {
    return { x: e.clientX || e.touches?.[0]?.clientX || e.changedTouches?.[0]?.clientX || 0,
             y: e.clientY || e.touches?.[0]?.clientY || e.changedTouches?.[0]?.clientY || 0 };
  }

  function onPointerDown(e) {
    isDragging = true; prevP = getPos(e);
    if (e.touches?.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
  }
  function onPointerMove(e) {
    if (!isDragging) return;
    if (e.touches?.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (touchStartDist > 0) { targetZoom = Math.max(0.4, Math.min(3, targetZoom * d / touchStartDist)); touchStartDist = d; }
    } else {
      const c = getPos(e);
      rotVel.x = (c.x - prevP.x) * 0.005;
      rotVel.y = (c.y - prevP.y) * 0.005;
      moonGroup.rotation.y += rotVel.x; moonGroup.rotation.x += rotVel.y;
      prevP = c;
    }
  }
  function onPointerUp() { isDragging = false; }
  function onWheel(e) { targetZoom = Math.max(0.4, Math.min(3, targetZoom - e.deltaY * 0.004)); }

  // Apply inertia
  function updateInertia() {
    if (!isDragging) { rotVel.x *= 0.94; rotVel.y *= 0.94; moonGroup.rotation.y += rotVel.x; moonGroup.rotation.x += rotVel.y; }
    currentZoom += (targetZoom - currentZoom) * 0.1;
    camera.position.z = 10 / currentZoom;
    camera.lookAt(0, 0, 0);
  }

  // Override animate to include inertia
  const origAnimate = animate;
  function animateWithInertia(time) {
    updateInertia();
    origAnimate(time);
  }
  // Cancel old rAF and restart with new
  stopped = false;  // reset
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animateWithInertia);

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    flash(duration = 2.0) {
      const st = performance.now();
      const orig = renderer.toneMappingExposure;
      function fl() {
        const e = (performance.now() - st) / 1000;
        if (e >= duration) { renderer.toneMappingExposure = orig; return; }
        const t = e / duration;
        renderer.toneMappingExposure = orig * (1 + (1 - t) * 6 * Math.exp(-t * 4));
        requestAnimationFrame(fl);
      }
      requestAnimationFrame(fl);
    },
    onPointerDown, onPointerMove, onPointerUp, onWheel,
    dispose() {
      stopped = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
      moonTexture.dispose();
    },
  };
}

// Procedural Moon texture
function createMoonTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size * 0.5;
  const ctx = canvas.getContext('2d');

  // Base gray
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Highlands / Maria
  for (let i = 0; i < 15; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 40 + Math.random() * 200;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${120 + Math.random() * 80},${120 + Math.random() * 80},${120 + Math.random() * 80},0.4)`;
    ctx.fill();
  }

  // Craters
  for (let i = 0; i < 300; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 1 + Math.random() * 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const shade = 80 + Math.random() * 80;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fill();
    // Crater rim highlight
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,200,200,0.4)`;
    ctx.fill();
  }

  // Streaks / rays
  for (let i = 0; i < 40; i++) {
    const sx = Math.random() * canvas.width;
    const sy = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 200, sy + (Math.random() - 0.5) * 200);
    ctx.strokeStyle = `rgba(200,200,200,0.15)`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
