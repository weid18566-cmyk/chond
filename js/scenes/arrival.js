// Arrival Scene — Exoplanet with atmosphere, starfield, nebula
import * as THREE from 'three';
import { atmosphereVertex } from '../shaders/atmosphere-vertex.glsl.js';
import { atmosphereFragment } from '../shaders/atmosphere-fragment.glsl.js';

export function createArrivalScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0.5, 8);
  camera.lookAt(0, 0, 0);

  // ── Planet Group ──
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);

  // Planet sphere
  const planetGeo = new THREE.SphereGeometry(1.8, 64, 64);
  const planetTexture = createProceduralPlanetTexture();
  const planetMat = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 0.7,
    metalness: 0.1,
  });
  const planet = new THREE.Mesh(planetGeo, planetMat);
  planetGroup.add(planet);

  // Atmosphere (larger semi-transparent sphere with Fresnel shader)
  const atmoGeo = new THREE.SphereGeometry(1.95, 64, 64);
  const atmoUniforms = {
    uViewDirection: { value: new THREE.Vector3() },
    uGlowColor: { value: new THREE.Color(0x00f0ff) },
    uGlowIntensity: { value: 1.2 },
    uTime: { value: 0 },
  };
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader: atmosphereFragment,
    uniforms: atmoUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  planetGroup.add(atmosphere);

  // Outer subtle glow
  const outerAtmoGeo = new THREE.SphereGeometry(2.05, 48, 48);
  const outerAtmoUniforms = {
    uViewDirection: { value: new THREE.Vector3() },
    uGlowColor: { value: new THREE.Color(0x7b2ff7) },
    uGlowIntensity: { value: 0.6 },
    uTime: { value: 0 },
  };
  const outerAtmoMat = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader: atmosphereFragment,
    uniforms: outerAtmoUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerAtmosphere = new THREE.Mesh(outerAtmoGeo, outerAtmoMat);
  planetGroup.add(outerAtmosphere);

  // ── Lighting ──
  const ambientLight = new THREE.AmbientLight(0x222244, 0.8);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffeedd, 3);
  sunLight.position.set(5, 2, 3);
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x4488ff, 1.5);
  rimLight.position.set(-3, -1, -2);
  scene.add(rimLight);

  // ── Stars ──
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 50 + Math.random() * 30;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe0e8ff,
    size: 0.06,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Nebula planes ──
  const nebulaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec2 uv = vUv;
        float n = noise(uv * 3.0 + uTime * 0.008);
        float n2 = noise(uv * 6.0 - uTime * 0.005);
        float alpha = smoothstep(0.43, 0.57, n) * 0.08;
        alpha += smoothstep(0.47, 0.53, n2) * 0.05;
        gl_FragColor = vec4(0.3, 0.1, 0.6, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  for (let i = 0; i < 4; i++) {
    const nebPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), nebulaMat);
    nebPlane.position.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 15,
      -8 - Math.random() * 8
    );
    nebPlane.name = 'nebula';
    scene.add(nebPlane);
  }

  // ── Star rays / lens flare points ──
  const flareCount = 8;
  const flareGeo = new THREE.BufferGeometry();
  const flarePositions = new Float32Array(flareCount * 3);
  for (let i = 0; i < flareCount; i++) {
    flarePositions[i * 3] = (Math.random() - 0.5) * 3;
    flarePositions[i * 3 + 1] = (Math.random() - 0.5) * 3;
    flarePositions[i * 3 + 2] = 2 + Math.random() * 3;
  }
  flareGeo.setAttribute('position', new THREE.BufferAttribute(flarePositions, 3));
  const flareMat = new THREE.PointsMaterial({
    color: 0x00f0ff,
    size: 0.15,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flares = new THREE.Points(flareGeo, flareMat);
  scene.add(flares);

  // ── Interaction state ──
  let isDragging = false;
  let prevPointer = { x: 0, y: 0 };
  let rotationVelocity = { x: 0, y: 0 };
  let targetZoom = 1;
  let currentZoom = 1;
  let touchStartDist = 0;

  // ── Animation loop ──
  function animate(time) {
    requestAnimationFrame(animate);
    const t = time * 0.001;

    // Rotate planet
    planet.rotation.y += 0.002;
    planet.rotation.x += Math.sin(t * 0.3) * 0.0005;

    // Atmosphere rotation (slower, different direction)
    atmosphere.rotation.y -= 0.001;
    outerAtmosphere.rotation.y -= 0.0007;
    outerAtmosphere.rotation.x += 0.0005;

    // Update view direction for Fresnel
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    atmoUniforms.uViewDirection.value.copy(camera.position);
    outerAtmoUniforms.uViewDirection.value.copy(camera.position);
    atmoUniforms.uTime.value = t;
    outerAtmoUniforms.uTime.value = t;

    // Rotation inertia decay
    if (!isDragging) {
      rotationVelocity.x *= 0.95;
      rotationVelocity.y *= 0.95;
      planetGroup.rotation.y += rotationVelocity.x;
      planetGroup.rotation.x += rotationVelocity.y;
    }

    // Zoom smooth
    currentZoom += (targetZoom - currentZoom) * 0.1;
    camera.position.z = 8 / currentZoom;
    camera.lookAt(0, 0, 0);

    // Star twinkle
    stars.rotation.y += 0.0002;
    stars.rotation.x += 0.0001;

    // Nebula update
    scene.children.forEach(c => {
      if (c.name === 'nebula' && c.material.uniforms) {
        c.material.uniforms.uTime.value = t;
      }
    });

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);

  // ── Touch/mouse interaction ──
  function getPointerPos(e) {
    const cx = e.clientX || e.touches?.[0]?.clientX || e.changedTouches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || e.changedTouches?.[0]?.clientY || 0;
    return { x: cx, y: cy };
  }

  function onPointerDown(e) {
    isDragging = true;
    prevPointer = getPointerPos(e);
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    if (e.touches && e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (touchStartDist > 0) {
        const scale = dist / touchStartDist;
        targetZoom = Math.max(0.5, Math.min(3, targetZoom * scale));
        touchStartDist = dist;
      }
    } else {
      const curr = getPointerPos(e);
      const dx = curr.x - prevPointer.x;
      const dy = curr.y - prevPointer.y;
      rotationVelocity.x = dx * 0.005;
      rotationVelocity.y = dy * 0.005;
      planetGroup.rotation.y += rotationVelocity.x;
      planetGroup.rotation.x += rotationVelocity.y;
      prevPointer = curr;
    }
  }

  function onPointerUp() {
    isDragging = false;
  }

  function onWheel(e) {
    targetZoom = Math.max(0.5, Math.min(3, targetZoom - e.deltaY * 0.005));
  }

  // ── Public API ──
  return {
    scene,
    camera,
    renderer,
    planetGroup,
    planetTexture: () => planetTexture,

    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    // Flash effect (on arrival)
    flash(duration = 1.5) {
      const startTime = performance.now();
      const origExposure = renderer.toneMappingExposure;
      function flashLoop() {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed >= duration) {
          renderer.toneMappingExposure = origExposure;
          return;
        }
        const t = elapsed / duration;
        renderer.toneMappingExposure = origExposure * (1 + (1 - t) * 5 * Math.exp(-t * 4));
        requestAnimationFrame(flashLoop);
      }
      requestAnimationFrame(flashLoop);
    },

    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,

    dispose() {
      renderer.dispose();
      planetTexture.dispose();
    },
  };
}

// Procedural planet texture using Canvas 2D
function createProceduralPlanetTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size * 0.5;
  const ctx = canvas.getContext('2d');

  // Base ocean
  const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  baseGrad.addColorStop(0, '#1a3a5c');
  baseGrad.addColorStop(0.3, '#1e5070');
  baseGrad.addColorStop(0.5, '#2a6080');
  baseGrad.addColorStop(0.7, '#1e5070');
  baseGrad.addColorStop(1, '#1a3a5c');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Land masses (fractal-like blobs)
  const continents = [
    { cx: 300, cy: 200, rx: 180, ry: 120, a: 0.2 },
    { cx: 700, cy: 180, rx: 140, ry: 100, a: -0.3 },
    { cx: 500, cy: 350, rx: 200, ry: 90, a: 0.1 },
    { cx: 100, cy: 300, rx: 120, ry: 80, a: 0.25 },
    { cx: 850, cy: 350, rx: 160, ry: 110, a: -0.15 },
  ];

  continents.forEach(({ cx, cy, rx, ry, a }) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    // Jagged edge using smaller overlapping ellipses
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const jx = Math.cos(angle) * rx * 0.7;
      const jy = Math.sin(angle) * ry * 0.7;
      ctx.moveTo(jx, jy);
      ctx.ellipse(jx, jy, rx * 0.35, ry * 0.35, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = 'rgba(60, 100, 70, 0.7)';
    ctx.fill();

    // Mountain/highland patches
    ctx.beginPath();
    ctx.ellipse(20, -10, rx * 0.5, ry * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80, 120, 60, 0.5)';
    ctx.fill();
    ctx.restore();
  });

  // Cloud bands
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * canvas.height;
    const w = 200 + Math.random() * 600;
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(Math.random() * canvas.width - 100, y, w, 2 + Math.random() * 6);
  }

  // Ice caps
  const iceGrad1 = ctx.createLinearGradient(0, 0, 0, 80);
  iceGrad1.addColorStop(0, 'rgba(220, 240, 255, 0.8)');
  iceGrad1.addColorStop(1, 'rgba(220, 240, 255, 0)');
  ctx.fillStyle = iceGrad1;
  ctx.fillRect(0, 0, canvas.width, 80);

  const iceGrad2 = ctx.createLinearGradient(0, canvas.height - 80, 0, canvas.height);
  iceGrad2.addColorStop(0, 'rgba(220, 240, 255, 0)');
  iceGrad2.addColorStop(1, 'rgba(220, 240, 255, 0.8)');
  ctx.fillStyle = iceGrad2;
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapU = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
