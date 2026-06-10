// Wormhole Flight Scene — First-person tunnel with particles, grid shader, streaking stars
import * as THREE from 'three';
import { wormholeVertex } from '../shaders/wormhole-vertex.glsl.js';
import { wormholeFragment } from '../shaders/wormhole-fragment.glsl.js';
import { particleVertex } from '../shaders/particle-vertex.glsl.js';
import { particleFragment } from '../shaders/particle-fragment.glsl.js';

export function createFlightScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080d);
  scene.fog = new THREE.FogExp2(0x06080d, 0.00012);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 0);

  const tunnelLength = 200;
  const tunnelRadius = 8;
  const gridDetail = perf.gridDetail;

  // ── Tunnel Cylinder (static, shader handles scrolling) ──
  const tunnelGeo = new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelLength, 48, gridDetail, true);
  const tunnelUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uTunnelLength: { value: tunnelLength },
    uGridDensity: { value: 0.5 },
    uGlowIntensity: { value: perf.bloomStrength },
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
  // Cylinder goes from -100..+100 in local Z after rotation
  // Place so far end is behind camera: center at -100, spans -200..0
  tunnel.position.z = -tunnelLength * 0.5;
  scene.add(tunnel);

  // ── Entrance rings ──
  const entranceGeo = new THREE.TorusGeometry(tunnelRadius, 0.15, 16, 100);
  const entranceMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.6 });
  const entrance = new THREE.Mesh(entranceGeo, entranceMat);
  entrance.position.z = 0.5;
  scene.add(entrance);

  const entranceOuter = new THREE.Mesh(
    new THREE.TorusGeometry(tunnelRadius + 0.3, 0.06, 12, 80),
    new THREE.MeshBasicMaterial({ color: 0x7b2ff7, transparent: true, opacity: 0.4 })
  );
  entranceOuter.position.z = 0.3;
  scene.add(entranceOuter);

  // ── Particle System ──
  const pCount = perf.particleBudget;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(pCount * 3);
  const pColors = new Float32Array(pCount * 3);
  const pSizes = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * (tunnelRadius - 0.3);
    const z = -Math.random() * tunnelLength;
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = Math.sin(angle) * dist;
    pPositions[i * 3 + 2] = z;
    const c = new THREE.Color();
    const colorT = -z / tunnelLength;
    if (colorT < 0.3) c.setHex(0x00f0ff);
    else if (colorT < 0.6) c.setHex(0x7b2ff7);
    else c.setHex(0xff00aa);
    pColors[i * 3] = c.r;
    pColors[i * 3 + 1] = c.g;
    pColors[i * 3 + 2] = c.b;
    pSizes[i] = Math.random() * 0.18 + 0.02;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));

  const pUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uTunnelLength: { value: tunnelLength },
  };
  const pMat = new THREE.ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms: pUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particleSystem = new THREE.Points(pGeo, pMat);
  scene.add(particleSystem);

  // ── Background stars ──
  const bgStarCount = 2000;
  const bgStarGeo = new THREE.BufferGeometry();
  const bgStarPos = new Float32Array(bgStarCount * 3);
  for (let i = 0; i < bgStarCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 100;
    bgStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgStarPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgStarPos[i * 3 + 2] = r * Math.cos(phi);
  }
  bgStarGeo.setAttribute('position', new THREE.BufferAttribute(bgStarPos, 3));
  const bgStars = new THREE.Points(bgStarGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.15, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(bgStars);

  // ── Nebula clouds ──
  for (let n = 0; n < 3; n++) {
    const nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIndex: { value: n } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uIndex;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p) { vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
        void main() {
          float n=noise(vUv*4.0+uTime*0.005+uIndex), n2=noise(vUv*8.0-uTime*0.003+uIndex*2.0);
          float a=smoothstep(0.45,0.55,n)*0.06+smoothstep(0.48,0.52,n2)*0.04;
          gl_FragColor=vec4(0.2+uIndex*0.2,0.05,0.5+uIndex*0.2,a);
        }`,
      transparent: true, depthWrite: false,
    });
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), nebMat);
    neb.position.set((n - 1) * 15, (Math.random() - 0.5) * 10, -40 - n * 20);
    neb.name = `nebula_${n}`;
    scene.add(neb);
  }

  // ── State ──
  let baseSpeed = 1.5;
  let currentSpeed = baseSpeed;
  let targetSpeed = baseSpeed;
  let isBoosting = false;
  let boostTimer = null;
  let traveled = 0;
  const totalDistance = 120;
  let isArriving = false;
  let arriveCallback = null;
  let arriveProgress = 0;
  let gyroEnabled = false;
  let gyroBeta = 0, gyroGamma = 0;
  let targetYaw = 0, targetPitch = 0;
  let currentYaw = 0, currentPitch = 0;
  let pointerDown = false;
  let lastPointerX = 0, lastPointerY = 0;

  // ── Gyroscope ──
  function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') { gyroEnabled = true; window.addEventListener('deviceorientation', onDeviceOrientation); }
      }).catch(() => {});
    } else if ('ondeviceorientation' in window) {
      gyroEnabled = true;
      window.addEventListener('deviceorientation', onDeviceOrientation);
    }
  }
  function onDeviceOrientation(e) {
    if (!gyroEnabled) return;
    gyroBeta = e.beta || 0;
    gyroGamma = e.gamma || 0;
    targetPitch = (gyroGamma / 90) * 0.25;
    targetYaw = (gyroBeta / 180) * 0.3;
  }

  // ── Update ──
  function update(dt) {
    if (isArriving) {
      arriveProgress = Math.min(1, arriveProgress + dt * 0.8);
      currentSpeed = baseSpeed * (1 - arriveProgress);
      if (arriveProgress >= 1 && arriveCallback) { arriveCallback(); arriveCallback = null; }
    }

    currentSpeed += (targetSpeed - currentSpeed) * 3 * dt;
    traveled += currentSpeed * dt;
    const progress = Math.min(traveled / totalDistance, 1);

    // Camera rotation
    if (gyroEnabled) {
      currentPitch += (targetPitch - currentPitch) * 5 * dt;
      currentYaw += (targetYaw - currentYaw) * 5 * dt;
    } else {
      const t = performance.now() * 0.001;
      targetPitch = Math.sin(t * 0.4) * 0.12;
      targetYaw = Math.cos(t * 0.35) * 0.1;
      currentPitch += (targetPitch - currentPitch) * 2 * dt;
      currentYaw += (targetYaw - currentYaw) * 2 * dt;
    }
    camera.rotation.set(currentPitch, currentYaw, 0);

    // Update shader uniforms
    const now = performance.now() * 0.001;
    tunnelUniforms.uTime.value = now;
    tunnelUniforms.uSpeed.value = currentSpeed;
    pUniforms.uTime.value = now;
    pUniforms.uSpeed.value = currentSpeed;

    // Entrance fade
    const entranceAlpha = Math.max(0, 1 - progress * 5);
    entrance.material.opacity = entranceAlpha * 0.6;
    entranceOuter.material.opacity = entranceAlpha * 0.4;

    // Boost glow
    const targetGlow = isBoosting ? perf.bloomStrength * 1.8 : perf.bloomStrength;
    tunnelUniforms.uGlowIntensity.value += (targetGlow - tunnelUniforms.uGlowIntensity.value) * 4 * dt;

    // Rotate bg stars
    bgStars.rotation.z += 0.0003 * currentSpeed;
    bgStars.rotation.y += 0.0002 * currentSpeed;

    // Nebula time
    scene.children.forEach(c => {
      if (c.name && c.name.startsWith('nebula_') && c.material.uniforms) {
        c.material.uniforms.uTime.value = now;
      }
    });

    renderer.render(scene, camera);
    return progress;
  }

  // ── Pointer input ──
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
    if (gyroEnabled) {
      targetPitch = targetPitch * 0.5 + (gyroGamma / 90) * 0.25;
      targetYaw = targetYaw * 0.5 + (gyroBeta / 180) * 0.3;
    }
  }
  function onPointerUp() {
    pointerDown = false;
  }

  function triggerBoost() {
    if (isBoosting) return;
    isBoosting = true;
    targetSpeed = baseSpeed * 2.2;
    if (boostTimer) clearTimeout(boostTimer);
    boostTimer = setTimeout(() => {
      isBoosting = false;
      targetSpeed = baseSpeed;
    }, 2000);
  }

  function endBoost() {
    if (boostTimer) clearTimeout(boostTimer);
    isBoosting = false;
    targetSpeed = baseSpeed;
  }

  // ── Public API ──
  return {
    scene, camera, renderer,
    enableGyro,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    start() { traveled = 0; targetSpeed = baseSpeed; enableGyro(); },
    update,
    getProgress() { return Math.min(traveled / totalDistance, 1); },
    getTraveled() { return traveled; },
    getTotalDistance() { return totalDistance; },
    startArrival(cb) { isArriving = true; arriveCallback = cb; arriveProgress = 0; },
    triggerBoost,
    isBoostActive() { return isBoosting; },
    setBaseSpeed(s) { baseSpeed = s; if (!isBoosting) targetSpeed = s; },
    getSpeed() { return currentSpeed; },
    onPointerDown, onPointerMove, onPointerUp,
    dispose() { renderer.dispose(); window.removeEventListener('deviceorientation', onDeviceOrientation); },
  };
}
