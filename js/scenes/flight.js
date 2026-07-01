// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  CLEAN WORMHOLE FLIGHT SCENE v3.0                                      ║
// ║  Earth (10km alt) → Moon surface traversal                              ║
// ║  Clean physics: black space + white grid + star streaks                 ║
// ╚═══════════════════════════════════════════════════════════════════════╝
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
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010204);
  scene.fog = new THREE.FogExp2(0x010204, 0.00005);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 0);
  // Camera looks along -Z into the tunnel

  const physics = createWormholePhysics();
  const tunnelLength = 280;
  const tunnelRadius = 12;
  const gridDetail = perf.gridDetail;

  // ══════════════ MAIN TUNNEL (clean grid) ══════════════
  const tunnelGeo = new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, tunnelLength, 64, gridDetail, true);
  const tunnelUniforms = {
    uTime:            { value: 0 },
    uSpeed:           { value: 0 },
    uTunnelLength:    { value: tunnelLength },
    uGridDensity:     { value: 0.55 },
    uGlowIntensity:   { value: 0.9 },
    uDopplerShift:    { value: 0 },
    uRingIntensity:   { value: 0.4 },
    uLensingStrength: { value: 2.0 },
    uThroatCenter:    { value: WORMHOLE_DB.throatPosition },
    uThroatWidth:     { value: WORMHOLE_DB.throatWidth },
    uWallDistortion:  { value: 0 },
    uFrameDrag:       { value: 0.3 },
    uProgress:        { value: 0 },
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

  // ══════════════ CLEAN PARTICLE STREAM (white points) ══════════════
  const pCount = Math.floor(perf.particleBudget * 0.5);
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(pCount * 3);
  const pSizes = new Float32Array(pCount);
  const pPhases = new Float32Array(pCount);

  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * (tunnelRadius - 0.5);
    pPositions[i * 3] = Math.cos(angle) * dist;
    pPositions[i * 3 + 1] = Math.sin(angle) * dist;
    pPositions[i * 3 + 2] = -Math.random() * tunnelLength;
    pSizes[i] = Math.random() * 0.12 + 0.015;
    pPhases[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhases, 1));

  const pUniforms = { uTime: { value: 0 }, uSpeed: { value: 0 }, uTunnelLength: { value: tunnelLength } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUniforms,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      varying float vAlpha;
      uniform float uTime, uSpeed, uTunnelLength;
      void main() {
        vec3 pos = position;
        float zNew = mod(pos.z - uTime * uSpeed * 5.0, -uTunnelLength);
        pos.z = zNew;
        float df = -pos.z / uTunnelLength;
        float dt = abs(df - 0.5);
        float rm = 1.0 - (1.0 - exp(-dt * dt / 0.008)) * 0.88;
        pos.x *= rm; pos.y *= rm;
        float tw = df * 2.5 + uTime * uSpeed * 0.4;
        float ox = pos.x, oy = pos.y;
        pos.x = ox * cos(tw) - oy * sin(tw);
        pos.y = ox * sin(tw) + oy * cos(tw);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (160.0 / max(-mv.z, 0.1)), 0.2, 4.0);
        vAlpha = 1.0 - smoothstep(0.92, 1.0, df);
        vAlpha *= (0.35 + exp(-dt * dt / 0.005) * 0.65);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0) * vAlpha * 0.6;
        gl_FragColor = vec4(vec3(0.8, 0.82, 0.9), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particleSystem = new THREE.Points(pGeo, pMat);
  scene.add(particleSystem);

  // ══════════════ BACKGROUND STAR FIELD ══════════════
  const starCount = perf.tier === 'high' ? 3000 : perf.tier === 'medium' ? 1500 : 800;
  const starGeo = new THREE.BufferGeometry();
  const starPosArr = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 90 + Math.random() * 70;
    starPosArr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPosArr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPosArr[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.03 + Math.random() * 0.15;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPosArr, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLensing: { value: 0 } },
    vertexShader: `
      attribute float aSize; uniform float uTime; uniform float uLensing;
      varying float vA;
      void main() {
        vec3 pos = position;
        float dist = length(pos.xy);
        vec2 dir = normalize(pos.xy + vec2(0.001));
        pos.xy += dir * uLensing * 4.0 / max(dist, 1.0);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (70.0 / max(-mv.z, 0.1)), 0.2, 2.5) * (1.0 + uLensing);
        vA = 0.5 + 0.5 * sin(uTime * (1.0 + aSize * 8.0) + pos.x * 0.05);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.5) * vA * 0.7;
        gl_FragColor = vec4(vec3(0.85, 0.88, 1.0), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ══════════════ ENTRANCE / EXIT PORTAL RINGS (subtle) ══════════════
  function createPortalRing(z, color) {
    const geo = new THREE.TorusGeometry(tunnelRadius, 0.2, 16, 140);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = z;
    return mesh;
  }

  const entranceRing = createPortalRing(0.5, 0x335577);
  scene.add(entranceRing);
  const exitRing = createPortalRing(-tunnelLength * 0.48, 0x665544);
  exitRing.scale.set(0.15, 0.15, 1);
  scene.add(exitRing);

  // ══════════════ EARTH SKY / MOON SKY ▮BACKGROUND▮ ══════════════
  const skyGeo = new THREE.SphereGeometry(110, 40, 40);

  const earthSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.45 } },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform float uTime; uniform float uAlpha;
      void main() {
        float h = vPos.y / 110.0;
        float a = smoothstep(0.08, 0.65, h) * uAlpha;
        vec3 sky = mix(vec3(0.02, 0.05, 0.18), vec3(0.01, 0.03, 0.1), smoothstep(0.15, 0.4, h));
        gl_FragColor = vec4(sky, a);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const earthSky = new THREE.Mesh(skyGeo, earthSkyMat);
  scene.add(earthSky);

  const moonSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.0 } },
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos; uniform float uTime; uniform float uAlpha;
      void main() {
        float a = smoothstep(0.08, 0.45, -vPos.y / 110.0) * uAlpha;
        gl_FragColor = vec4(vec3(0.07, 0.06, 0.04), a);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const moonSky = new THREE.Mesh(skyGeo.clone(), moonSkyMat);
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
  let currentYaw = 0, currentPitch = 0, currentRoll = 0;
  let pointerDown = false;
  let lastPointerX = 0, lastPointerY = 0;

  function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(s => {
        if (s === 'granted') { gyroEnabled = true; window.addEventListener('deviceorientation', od); }
      }).catch(() => {});
    } else if ('ondeviceorientation' in window) {
      gyroEnabled = true; window.addEventListener('deviceorientation', od);
    }
  }
  function od(e) {
    if (!gyroEnabled) return;
    gyroBeta = e.beta || 0; gyroGamma = e.gamma || 0;
    targetPitch = (gyroGamma / 90) * 0.2;
    targetYaw = (gyroBeta / 180) * 0.25;
  }

  // ══════════════ UPDATE ══════════════
  function update(dt) {
    if (isArriving) {
      arriveProgress = Math.min(1, arriveProgress + dt * 0.5);
      currentSpeed = baseSpeed * (1 - arriveProgress);
      if (arriveProgress >= 1 && arriveCallback) { arriveCallback(); arriveCallback = null; }
    }

    currentSpeed += (targetSpeed - currentSpeed) * 3 * dt;
    traveled += currentSpeed * 8000 * dt;
    const progress = Math.min(traveled / totalDistance, 1);
    const phys = physics.evaluate(progress);

    // Camera rotation
    if (gyroEnabled) {
      currentPitch += (targetPitch - currentPitch) * 5 * dt;
      currentYaw += (targetYaw - currentYaw) * 5 * dt;
    } else {
      const t = performance.now() * 0.001;
      targetPitch = Math.sin(t * 0.22) * 0.06 + Math.sin(t * 6.5) * phys.shake;
      targetYaw = Math.cos(t * 0.2) * 0.05 + Math.cos(t * 5.0) * phys.shake;
      currentPitch += (targetPitch - currentPitch) * 2 * dt;
      currentYaw += (targetYaw - currentYaw) * 2 * dt;
    }
    camera.rotation.set(currentPitch, currentYaw, currentRoll);

    // Dynamic FOV (subtle breathing)
    const throatFOV = phys.inThroat ? 8 : 0;
    const speedFOV = (currentSpeed * 2) * (isBoosting ? 1.3 : 1.0);
    const targetFOV = 75 + throatFOV + speedFOV;
    camera.fov += (targetFOV - camera.fov) * 2 * dt;
    camera.updateProjectionMatrix();

    // Dynamic exposure
    const targetExp = 1.2 + (isBoosting ? 0.3 : 0) + phys.photonSphere * 0.4;
    renderer.toneMappingExposure += (targetExp - renderer.toneMappingExposure) * 3 * dt;

    // Update uniforms
    const now = performance.now() * 0.001;
    tunnelUniforms.uTime.value = now;
    tunnelUniforms.uSpeed.value = currentSpeed * phys.speedMul;
    tunnelUniforms.uDopplerShift.value = phys.doppler;
    tunnelUniforms.uRingIntensity.value = phys.ringIntensity;
    tunnelUniforms.uLensingStrength.value = phys.lensing;
    tunnelUniforms.uWallDistortion.value = phys.wallDistortion;
    tunnelUniforms.uProgress.value = progress;
    pUniforms.uTime.value = now;
    pUniforms.uSpeed.value = currentSpeed * phys.speedMul;

    // Boost glow (subtle)
    const targetGlow = isBoosting ? 1.2 : 0.9;
    tunnelUniforms.uGlowIntensity.value += (targetGlow - tunnelUniforms.uGlowIntensity.value) * 4 * dt;

    // Entrance ring fade
    entranceRing.material.opacity = Math.max(0, 1 - progress * 5) * 0.35;
    // Exit ring scales up
    const exitScale = smoothstep_local(0.6, 0.95, progress);
    exitRing.scale.set(0.15 + exitScale * 0.85, 0.15 + exitScale * 0.85, 1);
    exitRing.material.opacity = exitScale * 0.35;

    // Sky transitions
    earthSkyMat.uniforms.uAlpha.value = (1 - smoothstep_local(0.03, 0.25, progress)) * 0.45;
    moonSkyMat.uniforms.uAlpha.value = smoothstep_local(0.68, 0.92, progress) * 0.45;

    // Star field lensing + rotation
    starMat.uniforms.uLensing.value = phys.lensing * 0.4;
    starMat.uniforms.uTime.value = now;
    starField.rotation.z += 0.0001 * currentSpeed;
    starField.rotation.y += 0.00008 * currentSpeed;

    renderer.render(scene, camera);
    return { progress, phys };
  }

  function smoothstep_local(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
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
    targetPitch = Math.max(-0.35, Math.min(0.35, targetPitch));
    targetYaw = Math.max(-0.45, Math.min(0.45, targetYaw));
    lastPointerX = cx; lastPointerY = cy;
  }
  function onPointerUp() { pointerDown = false; }

  function triggerBoost() {
    if (isBoosting) return;
    isBoosting = true; targetSpeed = baseSpeed * 2.6;
    if (boostTimer) clearTimeout(boostTimer);
    boostTimer = setTimeout(() => { isBoosting = false; targetSpeed = baseSpeed; }, 2600);
  }
  function endBoost() {
    if (boostTimer) clearTimeout(boostTimer);
    isBoosting = false; targetSpeed = baseSpeed;
  }

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    start() { traveled = 0; targetSpeed = baseSpeed; enableGyro(); },
    update, physics,
    getProgress() { return Math.min(traveled / totalDistance, 1); },
    getTraveled() { return traveled; },
    getTotalDistance() { return totalDistance; },
    getPhys() { return physics.evaluate(Math.min(traveled / totalDistance, 1)); },
    startArrival(cb) { isArriving = true; arriveCallback = cb; arriveProgress = 0; },
    triggerBoost, isBoostActive() { return isBoosting; },
    setBaseSpeed(s) { baseSpeed = s; if (!isBoosting) targetSpeed = s; },
    getSpeed() { return currentSpeed; },
    onPointerDown, onPointerMove, onPointerUp,
    dispose() {
      if (boostTimer) clearTimeout(boostTimer);
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
