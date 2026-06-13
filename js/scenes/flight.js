// Wormhole Flight Scene — Earth(Point A) → Moon(Point B) Interstellar traversal
// Camera inside the wormhole tunnel, physics-driven, cinematic visuals
import * as THREE from 'three';
import { wormholeVertex } from '../shaders/wormhole-vertex.glsl.js';
import { wormholeFragment } from '../shaders/wormhole-fragment.glsl.js';
import { createWormholePhysics, WORMHOLE_DB } from '../utils/physics.js';

export function createFlightScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x03050a, 0.00008);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 0);
  // Camera looks along -Z into the wormhole
  // tunnel entrance at ~z=0, throat at ~z=100, exit at ~z=200

  // ── Physics Engine ──
  const physics = createWormholePhysics();

  // ── Wormhole Tunnel ──
  const tunnelLength = 240;
  const tunnelRadius = 10;
  const gridDetail = perf.gridDetail;

  const tunnelGeo = new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelLength, 64, gridDetail, true);
  const tunnelUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uTunnelLength: { value: tunnelLength },
    uGridDensity: { value: 0.55 },
    uGlowIntensity: { value: perf.bloomStrength },
    uDopplerShift: { value: 0 },
    uRingIntensity: { value: 0.4 },
    uLensingStrength: { value: 1.5 },
    uThroatCenter: { value: WORMHOLE_DB.throatPosition },
    uThroatWidth: { value: WORMHOLE_DB.throatWidth },
    uWallDistortion: { value: 0 },
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
  tunnel.position.z = -tunnelLength * 0.5; // spans z=[-120, 120], camera at z=0
  scene.add(tunnel);

  // ── Entrance / Exit rings ──
  const ringGeo = new THREE.TorusGeometry(tunnelRadius, 0.2, 16, 128);
  const entranceRing = new THREE.Mesh(ringGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x00aaff) }, uAlpha: { value: 0.7 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uAlpha;
        void main(){ float d=abs(vUv.x-0.5)*2.0; float a=smoothstep(0.0,0.15,d)*uAlpha;
        gl_FragColor=vec4(uColor,a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  entranceRing.position.z = 0.5;
  scene.add(entranceRing);

  const exitRing = new THREE.Mesh(ringGeo.clone(),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xff8800) }, uAlpha: { value: 0.3 } },
      vertexShader: entranceRing.material.vertexShader,
      fragmentShader: entranceRing.material.fragmentShader,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  exitRing.position.z = -tunnelLength * 0.48;
  exitRing.scale.set(0.15, 0.15, 1);
  scene.add(exitRing);

  // ── Particle Stream ──
  const pCount = perf.particleBudget;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  const pSizes = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.2 + Math.random() * (tunnelRadius - 0.2);
    const z = -Math.random() * tunnelLength;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = Math.sin(angle) * dist;
    pPositions[i * 3 + 2] = z;
    const ct = -z / tunnelLength;
    const c = new THREE.Color();
    if (ct < 0.35) c.setRGB(0, 0.7, 1);
    else if (ct < 0.55) c.setRGB(0.9, 0.85, 1);
    else c.setRGB(1, 0.5, 0.15);
    pColors[i * 3] = c.r; pColors[i * 3 + 1] = c.g; pColors[i * 3 + 2] = c.b;
    pSizes[i] = Math.random() * 0.22 + 0.02;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));

  const pUniforms = { uTime: { value: 0 }, uSpeed: { value: 0 }, uTunnelLength: { value: tunnelLength } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms,
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute float aSize;
      varying vec3 vColor; varying float vAlpha;
      uniform float uTime, uSpeed, uTunnelLength;
      void main() {
        vec3 pos = position;
        float zNew = mod(pos.z - uTime * uSpeed * 5.0, -uTunnelLength);
        pos.z = zNew;
        float df = -pos.z / uTunnelLength;
        float rm = 1.0 - (1.0 - exp(-abs(df - 0.5) * abs(df - 0.5) / 0.0005)) * 0.88;
        pos.x *= rm; pos.y *= rm;
        float tw = df * 2.8 + uTime * uSpeed * 0.5;
        float ox = pos.x, oy = pos.y;
        pos.x = ox * cos(tw) - oy * sin(tw);
        pos.y = ox * sin(tw) + oy * cos(tw);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (200.0 / -mv.z), 0.25, 7.0);
        vAlpha = 1.0 - smoothstep(0.9, 1.0, df);
        vColor = color;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.8) * vAlpha * 0.75;
        gl_FragColor = vec4(vColor, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particleSystem = new THREE.Points(pGeo, pMat);
  scene.add(particleSystem);

  // ── Earth Sky Background (at entrance) ──
  const earthSkyGeo = new THREE.SphereGeometry(80, 32, 32);
  const earthSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform float uTime;
      void main() {
        float h = vPos.y / 80.0;
        float alpha = smoothstep(0.15, 0.8, h) * 0.5;
        vec3 sky = mix(vec3(0.05, 0.1, 0.3), vec3(0.02, 0.05, 0.2), smoothstep(0.3, 0.6, h));
        gl_FragColor = vec4(sky, alpha);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const earthSky = new THREE.Mesh(earthSkyGeo, earthSkyMat);
  scene.add(earthSky);

  // ── Moon Sky Background (at exit) ──
  const moonSkyGeo = new THREE.SphereGeometry(80, 32, 32);
  const moonSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        float a = smoothstep(0.1, 0.6, -vPos.y / 80.0) * 0.5;
        gl_FragColor = vec4(vec3(0.1, 0.08, 0.06), a);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const moonSky = new THREE.Mesh(moonSkyGeo, moonSkyMat);
  scene.add(moonSky);

  // ── Starfield (rotating) ──
  const starCount = 2500;
  const starGeo = new THREE.BufferGeometry();
  const starPosArr = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 120;
    starPosArr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPosArr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPosArr[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
  const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.12, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(starField);

  // ── State ──
  let baseSpeed = 1.8;
  let currentSpeed = baseSpeed;
  let targetSpeed = baseSpeed;
  let isBoosting = false;
  let boostTimer = null;
  let traveled = 0;
  const totalDistance = 384400; // km
  let isArriving = false;
  let arriveCallback = null;
  let arriveProgress = 0;
  let gyroEnabled = false;
  let gyroBeta = 0, gyroGamma = 0;
  let targetYaw = 0, targetPitch = 0;
  let currentYaw = 0, currentPitch = 0;
  let pointerDown = false;
  let lastPointerX = 0, lastPointerY = 0;

  // ── Gyro ──
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
    targetPitch = (gyroGamma / 90) * 0.3;
    targetYaw = (gyroBeta / 180) * 0.35;
  }

  // ── Update ──
  function update(dt) {
    if (isArriving) {
      arriveProgress = Math.min(1, arriveProgress + dt * 0.6);
      currentSpeed = baseSpeed * (1 - arriveProgress);
      if (arriveProgress >= 1 && arriveCallback) { arriveCallback(); arriveCallback = null; }
    }

    currentSpeed += (targetSpeed - currentSpeed) * 3 * dt;
    traveled += currentSpeed * 8000 * dt; // scale to km
    const progress = Math.min(traveled / totalDistance, 1);

    // ── Physics Evaluation ──
    const phys = physics.evaluate(progress);

    // Camera rotation (gyro or auto)
    if (gyroEnabled) {
      currentPitch += (targetPitch - currentPitch) * 5 * dt;
      currentYaw += (targetYaw - currentYaw) * 5 * dt;
    } else {
      const t = performance.now() * 0.001;
      const shake = phys.shake;
      targetPitch = Math.sin(t * 0.35) * 0.12 + Math.sin(t * 7.3) * shake;
      targetYaw = Math.cos(t * 0.3) * 0.1 + Math.cos(t * 5.7) * shake;
      currentPitch += (targetPitch - currentPitch) * 2 * dt;
      currentYaw += (targetYaw - currentYaw) * 2 * dt;
    }
    camera.rotation.set(currentPitch, currentYaw, 0);

    // ── Update tunnel shader uniforms with physics ──
    const now = performance.now() * 0.001;
    tunnelUniforms.uTime.value = now;
    tunnelUniforms.uSpeed.value = currentSpeed * phys.speedMul;
    tunnelUniforms.uDopplerShift.value = phys.doppler;
    tunnelUniforms.uRingIntensity.value = phys.ringIntensity;
    tunnelUniforms.uLensingStrength.value = phys.lensing;
    tunnelUniforms.uWallDistortion.value = phys.wallDistortion;
    pUniforms.uTime.value = now;
    pUniforms.uSpeed.value = currentSpeed * phys.speedMul;

    // Boost glow
    const targetGlow = isBoosting ? perf.bloomStrength * 2.0 : perf.bloomStrength;
    tunnelUniforms.uGlowIntensity.value += (targetGlow - tunnelUniforms.uGlowIntensity.value) * 4 * dt;

    // ── Background sky transitions ──
    // Earth sky fades out as we leave Earth; Moon sky fades in as we approach the Moon
    const earthAlpha = 1 - smoothstep_local(0.05, 0.25, progress);
    const moonAlpha = smoothstep_local(0.7, 0.95, progress);
    earthSky.material.uniforms.uAlpha = { value: earthAlpha };
    moonSky.material.uniforms.uAlpha = { value: moonAlpha };

    // Update Earth sky opacity
    const earthMtl = earthSky.material;
    if (earthMtl.uniforms) {
      earthMtl.opacity = earthAlpha * 0.5;
    }

    // ── Entrance/exit rings ──
    entranceRing.material.uniforms.uAlpha.value = Math.max(0, 1 - progress * 6);
    exitRing.material.uniforms.uAlpha.value = smoothstep_local(0.6, 0.9, progress) * 0.7;
    exitRing.scale.setScalar(0.15 + smoothstep_local(0.7, 0.95, progress) * 0.85);

    // ── Star field rotation ──
    starField.rotation.z += 0.0002 * currentSpeed;
    starField.rotation.y += 0.00015 * currentSpeed;

    // ── Render ──
    renderer.render(scene, camera);
    return { progress, phys };
  }

  function smoothstep_local(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // ── Input ──
  function onPointerDown(e) {
    pointerDown = true;
    lastPointerX = e.clientX || e.touches?.[0]?.clientX || 0;
    lastPointerY = e.clientY || e.touches?.[0]?.clientY || 0;
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    targetYaw += (cx - lastPointerX) * 0.0025;
    targetPitch += (cy - lastPointerY) * 0.0025;
    targetPitch = Math.max(-0.5, Math.min(0.5, targetPitch));
    targetYaw = Math.max(-0.6, Math.min(0.6, targetYaw));
    lastPointerX = cx; lastPointerY = cy;
  }
  function onPointerUp() { pointerDown = false; }

  function triggerBoost() {
    if (isBoosting) return;
    isBoosting = true; targetSpeed = baseSpeed * 2.4;
    if (boostTimer) clearTimeout(boostTimer);
    boostTimer = setTimeout(() => { isBoosting = false; targetSpeed = baseSpeed; }, 2500);
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
      renderer.dispose();
      window.removeEventListener('deviceorientation', od);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
    },
  };
}
