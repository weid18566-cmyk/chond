// Arrival — Moon surface (no renderer)
import * as THREE from 'three';

export function createArrivalScene(perf) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 1.5, 10);

  // Moon
  const moonGroup = new THREE.Group();
  const moonGeo = new THREE.SphereGeometry(2.5, 80, 80);
  const moonTex = createMoonTex();
  const moon = new THREE.Mesh(moonGeo, new THREE.MeshStandardMaterial({
    map: moonTex, roughness: 0.9, metalness: 0.02, color: 0xcccccc,
  }));
  moonGroup.add(moon);

  // Stars
  const sCount = Math.floor(perf.starCount * 1.5);
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sCount * 3);
  const sSz = new Float32Array(sCount);
  for (let i = 0; i < sCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 75 + Math.random() * 55;
    sPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    sPos[i * 3 + 2] = r * Math.cos(ph);
    sSz[i] = 0.03 + Math.random() * 0.14;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSz, 1));
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; uniform float uTime; varying float vT;
      void main(){ vec4 m=modelViewMatrix*vec4(position,1.0);
      vT=0.45+0.55*sin(uTime*(0.4+aSize*5.0)+position.x*0.03);
      gl_PointSize=aSize*vT*(55.0/max(-m.z,0.1)); gl_Position=projectionMatrix*m; }`,
    fragmentShader: `varying float vT;
      void main(){ float d=length(gl_PointCoord-0.5)*2.0;
      gl_FragColor=vec4(vec3(0.88,0.9,1.0),pow(1.0-smoothstep(0.0,1.0,d),3.0)*vT*0.85); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stars = new THREE.Points(sGeo, sMat); scene.add(stars);

  // Earth in distance
  const eGeo = new THREE.SphereGeometry(0.45, 40, 40);
  const eMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 n; void main(){ n=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 n; uniform float uTime;
      void main(){ float f=1.0-abs(dot(normalize(vec3(1,0.3,0)),n));
      vec3 c=mix(vec3(0.12,0.35,0.85),vec3(0.05,0.12,0.35),f);
      gl_FragColor=vec4(c,1.0); }`,
  });
  const earth = new THREE.Mesh(eGeo, eMat); earth.position.set(10, 4, -18); scene.add(earth);
  const eaGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const eaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: eMat.vertexShader,
    fragmentShader: `varying vec3 n; uniform float uTime;
      void main(){ float f=pow(1.0-abs(dot(normalize(vec3(10,4,-18)),normalize(mat3(modelMatrix)*normal))),3.0);
      gl_FragColor=vec4(vec3(0.15,0.4,0.9),f*0.35); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Mesh(eaGeo, eaMat)).position.copy(earth.position);

  // Lighting
  scene.add(new THREE.AmbientLight(0x111122, 0.4));
  const sun = new THREE.DirectionalLight(0xffeedd, 5); sun.position.set(12, 6, 8); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x336688, 0.3); rim.position.set(-8, -2, -6); scene.add(rim);

  scene.add(moonGroup);

  // ══════ Interaction ══════
  let dragging = false, pp = { x: 0, y: 0 }, rv = { x: 0, y: 0 };
  let tz = 1, cz = 1, tsd = 0;

  function gp(e) { return { x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 }; }
  function onPointerDown(e) { dragging = true; pp = gp(e); if (e.touches?.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; tsd = Math.sqrt(dx * dx + dy * dy); } }
  function onPointerMove(e) {
    if (!dragging) return;
    if (e.touches?.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const d = Math.sqrt(dx * dx + dy * dy); if (tsd > 0) { tz = Math.max(0.3, Math.min(4, tz * d / tsd)); tsd = d; } }
    else { const c = gp(e); rv.x = (c.x - pp.x) * 0.004; rv.y = (c.y - pp.y) * 0.004; moonGroup.rotation.y += rv.x; moonGroup.rotation.x += rv.y; pp = c; }
  }
  function onPointerUp() { dragging = false; }
  function onWheel(e) { tz = Math.max(0.3, Math.min(4, tz - e.deltaY * 0.005)); }

  // ══════ Animation ══════
  let elapsed = 0;

  function update(dt) {
    elapsed += dt;
    const t = elapsed;

    if (!dragging) { rv.x *= 0.94; rv.y *= 0.94; moonGroup.rotation.y += rv.x * dt * 60; moonGroup.rotation.x += rv.y * dt * 60; }
    cz += (tz - cz) * 0.08;
    camera.position.z = 10 / cz; camera.lookAt(0, 0, 0);

    moon.rotation.y += 0.001 * dt * 60;
    stars.rotation.y += 0.00006 * dt * 60; stars.rotation.x += 0.00003 * dt * 60;
    earth.rotation.y += 0.0012 * dt * 60;
    sMat.uniforms.uTime.value = t;
    eMat.uniforms.uTime.value = t;
    eaMat.uniforms.uTime.value = t;
  }

  let flashDur = 0, flashStart = 0, flashOrig = 0;
  let flashRaf = null, stopped = false;

  return {
    scene, camera, update,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    flash(dur = 2.5) { flashDur = dur; flashStart = performance.now(); flashOrig = 1; },
    getFlashExposure() {
      if (flashDur <= 0) return 0;
      const e = (performance.now() - flashStart) / 1000;
      if (e >= flashDur) { flashDur = 0; return 0; }
      const t = e / flashDur;
      return (1 - t) * 6 * Math.exp(-t * 3);
    },
    onPointerDown, onPointerMove, onPointerUp, onWheel,
    dispose() {
      stopped = true;
      if (flashRaf) { cancelAnimationFrame(flashRaf); flashRaf = null; }
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
      moonTex.dispose();
    },
  };
}

function createMoonTex() {
  const sz = 512, c = document.createElement('canvas'); c.width = sz; c.height = sz * 0.5;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#b0b0b0'; ctx.fillRect(0, 0, sz, sz * 0.5);
  for (let i = 0; i < 4000; i++) { const s = 90 + Math.random() * 80; ctx.fillStyle = `rgba(${s},${s},${s + 5},0.25)`; ctx.fillRect(Math.random() * sz, Math.random() * sz * 0.5, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 15; i++) { const cx = Math.random() * sz, cy = Math.random() * sz * 0.5, r = 30 + Math.random() * 180; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); const s = 100 + Math.random() * 90; ctx.fillStyle = `rgba(${s},${s},${s + 10},0.3)`; ctx.fill(); }
  for (let i = 0; i < 200; i++) { const cx = Math.random() * sz, cy = Math.random() * sz * 0.5, r = 1 + Math.random() * 18; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); const s = 70 + Math.random() * 70; ctx.fillStyle = `rgb(${s},${s},${s + 4})`; ctx.fill(); ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = `rgba(195,195,200,0.2)`; ctx.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  return tex;
}
