// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR ARRIVAL SCENE v2.0 — Moon Surface                       ║
// ║  Enhanced with better lighting, procedural surface, Earth glow,       ║
// ║  star parallax, and cinematic post-processing                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';

export function createArrivalScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 1.5, 10);
  camera.lookAt(0, 0, 0);

  // ── Moon Group ──
  const moonGroup = new THREE.Group();
  scene.add(moonGroup);

  // Moon sphere with enhanced texture
  const moonGeo = new THREE.SphereGeometry(2.5, 96, 96);
  const moonTexture = createMoonTexture();
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTexture,
    roughness: 0.9,
    metalness: 0.02,
    color: 0xcccccc,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moonGroup.add(moon);

  // ── Moon atmosphere (extremely thin) ──
  const atmoGeo = new THREE.SphereGeometry(2.65, 64, 64);
  const atmoUniforms = {
    uViewDirection: { value: new THREE.Vector3() },
    uGlowColor: { value: new THREE.Color(0xffaa66) },
    uGlowIntensity: { value: 0.3 },
    uTime: { value: 0 },
  };
  const atmoVShader = `varying vec3 vN; varying vec3 vWP;
    void main(){ vN=normalize(mat3(modelMatrix)*normal); vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const atmoFShader = `varying vec3 vN; varying vec3 vWP;
    uniform vec3 uViewDirection; uniform vec3 uGlowColor; uniform float uGlowIntensity; uniform float uTime;
    void main(){ vec3 vd=normalize(uViewDirection-vWP); float f=pow(1.0-abs(dot(vd,vN)),4.0);
    gl_FragColor=vec4(uGlowColor,f*uGlowIntensity*0.35); }`;
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: atmoVShader, fragmentShader: atmoFShader,
    uniforms: atmoUniforms,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  moonGroup.add(atmosphere);

  // ── Crater details ──
  const craterCount = 300;
  const craterGeo = new THREE.BufferGeometry();
  const craterPos = new Float32Array(craterCount * 3);
  const craterSizes = new Float32Array(craterCount);
  for (let i = 0; i < craterCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = 2.52;
    craterPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    craterPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    craterPos[i * 3 + 2] = r * Math.cos(phi);
    craterSizes[i] = 0.02 + Math.random() * 0.08;
  }
  craterGeo.setAttribute('position', new THREE.BufferAttribute(craterPos, 3));
  craterGeo.setAttribute('aSize', new THREE.BufferAttribute(craterSizes, 1));
  const craters = new THREE.Points(craterGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; uniform float uTime;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (60.0 / max(-mv.z, 0.1));
        vA = 0.3 + 0.2 * sin(uTime * 0.5 + position.x * 10.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0) * vA;
        gl_FragColor = vec4(vec3(0.3), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  moonGroup.add(craters);

  // ── Star field (bright, no atmosphere) ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = Math.floor(perf.starCount * 1.8);
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 70 + Math.random() * 60;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.03 + Math.random() * 0.18;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize; uniform float uTime;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vTwinkle = 0.5 + 0.5 * sin(uTime * (0.5 + aSize * 8.0) + position.x * 0.05);
        gl_PointSize = aSize * vTwinkle * (60.0 / max(-mv.z, 0.1));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 3.0) * vTwinkle * 0.95;
        gl_FragColor = vec4(vec3(0.9, 0.92, 1.0), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Milky Way band ──
  const milkyGeo = new THREE.BufferGeometry();
  const milkyCount = perf.tier === 'high' ? 2000 : 800;
  const milkyPos = new Float32Array(milkyCount * 3);
  for (let i = 0; i < milkyCount; i++) {
    const angle = (Math.random() - 0.5) * Math.PI * 0.8;
    const dist = 40 + Math.random() * 80;
    milkyPos[i * 3] = Math.cos(angle) * dist;
    milkyPos[i * 3 + 1] = (Math.random() - 0.5) * 4;
    milkyPos[i * 3 + 2] = Math.sin(angle) * dist;
  }
  milkyGeo.setAttribute('position', new THREE.BufferAttribute(milkyPos, 3));
  const milkyWay = new THREE.Points(milkyGeo, new THREE.PointsMaterial({
    color: 0x8888aa, size: 0.06, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  milkyWay.rotation.x = Math.PI * 0.15;
  scene.add(milkyWay);

  // ── Distant Earth (blue marble) ──
  const earthGeo = new THREE.SphereGeometry(0.4, 48, 48);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vPos;
      void main(){ vN=normalize(normalMatrix*normal); vPos=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; varying vec3 vPos; uniform float uTime;
      void main(){
        float f=1.0-abs(dot(normalize(vec3(1,0.3,0)),vN));
        vec3 ocean=vec3(0.15,0.4,0.9);
        vec3 land=vec3(0.2,0.55,0.25);
        vec3 cloud=vec3(0.9,0.92,0.95);
        // Simple land masses
        float landPattern=sin(vPos.x*8.0)*cos(vPos.y*6.0)*sin(vPos.z*7.0);
        vec3 base=mix(ocean,land,smoothstep(0.1,0.4,landPattern));
        base=mix(base,cloud,smoothstep(0.3,0.6,landPattern*1.5)*0.3);
        vec3 col=mix(base,vec3(0.05,0.1,0.4),f);
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.position.set(10, 4, -18);
  scene.add(earth);

  // Earth atmosphere glow
  const earthAtmoGeo = new THREE.SphereGeometry(0.5, 48, 48);
  const earthAtmoMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: atmoVShader,
    fragmentShader: `varying vec3 vN; varying vec3 vWP;
      uniform float uTime;
      void main(){
        vec3 vd=normalize(vec3(10,4,-18)-vWP);
        float f=pow(1.0-abs(dot(vd,vN)),3.5);
        float pulse=0.8+0.2*sin(uTime*0.5);
        gl_FragColor=vec4(vec3(0.2,0.5,1.0)*pulse,f*0.45);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const earthAtmo = new THREE.Mesh(earthAtmoGeo, earthAtmoMat);
  earthAtmo.position.copy(earth.position);
  scene.add(earthAtmo);

  // ── Lighting ──
  const ambientLight = new THREE.AmbientLight(0x111122, 0.5);
  scene.add(ambientLight);
  const sun = new THREE.DirectionalLight(0xffeedd, 4.5);
  sun.position.set(12, 6, 8);
  scene.add(sun);

  // Subtle rim light
  const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
  rimLight.position.set(-8, -2, -5);
  scene.add(rimLight);

  // ── Animation ──
  let rafId = null;
  let stopped = false;
  const animTime = { value: 0 };

  function animate(time) {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const t = time * 0.001;
    animTime.value = t;

    moon.rotation.y += 0.0012;
    atmosphere.rotation.y -= 0.0006;
    atmosphere.rotation.x += 0.0003;
    stars.rotation.y += 0.00008;
    stars.rotation.x += 0.00003;
    craters.rotation.y += 0.0012;

    const cd = new THREE.Vector3();
    camera.getWorldDirection(cd);
    atmoUniforms.uViewDirection.value.copy(camera.position);
    atmoUniforms.uTime.value = t;
    earth.rotation.y += 0.0015;
    earthMat.uniforms.uTime.value = t;
    earthAtmoMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    craters.material.uniforms.uTime.value = t;

    renderer.render(scene, camera);
  }

  // ── Interaction ──
  let isDragging = false, prevP = { x: 0, y: 0 };
  let rotVel = { x: 0, y: 0 };
  let targetZoom = 1, currentZoom = 1;
  let touchStartDist = 0;

  function getPos(e) {
    return {
      x: e.clientX || e.touches?.[0]?.clientX || e.changedTouches?.[0]?.clientX || 0,
      y: e.clientY || e.touches?.[0]?.clientY || e.changedTouches?.[0]?.clientY || 0
    };
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
      if (touchStartDist > 0) { targetZoom = Math.max(0.3, Math.min(4, targetZoom * d / touchStartDist)); touchStartDist = d; }
    } else {
      const c = getPos(e);
      rotVel.x = (c.x - prevP.x) * 0.004;
      rotVel.y = (c.y - prevP.y) * 0.004;
      moonGroup.rotation.y += rotVel.x; moonGroup.rotation.x += rotVel.y;
      prevP = c;
    }
  }
  function onPointerUp() { isDragging = false; }
  function onWheel(e) { targetZoom = Math.max(0.3, Math.min(4, targetZoom - e.deltaY * 0.005)); }

  function updateInertia() {
    if (!isDragging) {
      rotVel.x *= 0.94; rotVel.y *= 0.94;
      moonGroup.rotation.y += rotVel.x; moonGroup.rotation.x += rotVel.y;
    }
    currentZoom += (targetZoom - currentZoom) * 0.08;
    camera.position.z = 10 / currentZoom;
    camera.lookAt(0, 0, 0);
  }

  function animate(time) {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    updateInertia();
    const t = time * 0.001;
    animTime.value = t;

    moon.rotation.y += 0.0012;
    atmosphere.rotation.y -= 0.0006;
    atmosphere.rotation.x += 0.0003;
    stars.rotation.y += 0.00008;
    stars.rotation.x += 0.00003;
    craters.rotation.y += 0.0012;

    const cd = new THREE.Vector3();
    camera.getWorldDirection(cd);
    atmoUniforms.uViewDirection.value.copy(camera.position);
    atmoUniforms.uTime.value = t;
    earth.rotation.y += 0.0015;
    earthMat.uniforms.uTime.value = t;
    earthAtmoMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    craters.material.uniforms.uTime.value = t;

    renderer.render(scene, camera);
  }

  stopped = false;
  rafId = requestAnimationFrame(animate);

  let flashRafId = null;

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    flash(duration = 3.0) {
      const st = performance.now();
      const orig = renderer.toneMappingExposure;
      function fl() {
        if (stopped) return;
        const e = (performance.now() - st) / 1000;
        if (e >= duration) { renderer.toneMappingExposure = orig; flashRafId = null; return; }
        const t = e / duration;
        renderer.toneMappingExposure = orig * (1 + (1 - t) * 8 * Math.exp(-t * 3));
        flashRafId = requestAnimationFrame(fl);
      }
      flashRafId = requestAnimationFrame(fl);
    },
    onPointerDown, onPointerMove, onPointerUp, onWheel,
    dispose() {
      stopped = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (flashRafId) { cancelAnimationFrame(flashRafId); flashRafId = null; }
      renderer.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      moonTexture.dispose();
    },
  };
}

// ── Procedural Moon texture (enhanced) ──
function createMoonTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size * 0.5;
  const ctx = canvas.getContext('2d');

  // Base gray with subtle blue tint
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Global noise overlay
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const s = 100 + Math.random() * 56;
    ctx.fillStyle = `rgba(${s},${s},${s + Math.random() * 10},0.3)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Highlands / Maria (larger regions)
  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 30 + Math.random() * 250;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const shade = 100 + Math.random() * 100;
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 10},0.35)`;
    ctx.fill();
  }

  // Maria (dark flat areas)
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 60 + Math.random() * 150;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(80,80,90,0.4)');
    grad.addColorStop(1, 'rgba(80,80,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Craters (various sizes)
  for (let i = 0; i < 400; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 0.5 + Math.random() * 25;

    // Crater floor (darker)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const shade = 70 + Math.random() * 80;
    ctx.fillStyle = `rgb(${shade},${shade},${shade + 5})`;
    ctx.fill();

    // Crater rim highlight
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,200,205,${0.2 + Math.random() * 0.2})`;
    ctx.fill();

    // Crater shadow
    ctx.beginPath();
    ctx.arc(cx + r * 0.2, cy + r * 0.2, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(40,40,45,${0.1 + Math.random() * 0.15})`;
    ctx.fill();
  }

  // Ray systems (bright streaks from major craters)
  for (let i = 0; i < 6; i++) {
    const sx = Math.random() * canvas.width;
    const sy = Math.random() * canvas.height;
    const rays = 4 + Math.floor(Math.random() * 6);
    for (let j = 0; j < rays; j++) {
      const angle = (j / rays) * Math.PI * 2 + Math.random() * 0.3;
      const len = 40 + Math.random() * 180;
      const ex = sx + Math.cos(angle) * len;
      const ey = sy + Math.sin(angle) * len;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = `rgba(210,210,215,${0.08 + Math.random() * 0.12})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.stroke();
    }
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
