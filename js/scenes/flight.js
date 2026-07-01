// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  WORMHOLE FLIGHT — Earth→Moon tunnel with converging stars            ║
// ║  Stars warp toward center forming tunnel; speed ramps exponentially   ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';
import { wormholeVertex } from '../shaders/wormhole-vertex.glsl.js';
import { wormholeFragment } from '../shaders/wormhole-fragment.glsl.js';
import { createWormholePhysics, WORMHOLE_DB } from '../utils/physics.js';

export function createFlightScene(perf) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010204);
  scene.fog = new THREE.FogExp2(0x010204, 0.00004);

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, 0);

  const physics = createWormholePhysics();
  const TL = 280, TR = 12;

  // ══════════════ TUNNEL CYLINDER ══════════════
  const tGeo = new THREE.CylinderGeometry(TR, TR, TL, 64, perf.gridDetail, true);
  const tUni = {
    uTime: { value: 0 }, uSpeed: { value: 0 }, uTunnelLength: { value: TL },
    uGridDensity: { value: 0.55 }, uGlowIntensity: { value: 0.85 },
    uDopplerShift: { value: 0 }, uRingIntensity: { value: 0.35 },
    uLensingStrength: { value: 2.0 }, uThroatCenter: { value: 0.5 },
    uThroatWidth: { value: WORMHOLE_DB.throatWidth },
    uWallDistortion: { value: 0 }, uFrameDrag: { value: 0.3 }, uProgress: { value: 0 },
  };
  const tMat = new THREE.ShaderMaterial({
    vertexShader: wormholeVertex, fragmentShader: wormholeFragment, uniforms: tUni,
    side: THREE.BackSide, transparent: true, depthWrite: true,
  });
  const tunnel = new THREE.Mesh(tGeo, tMat);
  tunnel.rotation.x = Math.PI * 0.5;
  tunnel.position.z = -TL * 0.5;
  scene.add(tunnel);

  // ══════════════ CONVERGING STAR FIELD ══════════════
  // Stars get pulled toward center as you enter the wormhole
  const sCount = perf.tier === 'high' ? 4000 : perf.tier === 'medium' ? 2000 : 1000;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sCount * 3);
  const sSz = new Float32Array(sCount);
  const sOrig = new Float32Array(sCount * 3);
  for (let i = 0; i < sCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 80;
    const x = r * Math.sin(ph) * Math.cos(th);
    const y = r * Math.sin(ph) * Math.sin(th);
    const z = r * Math.cos(ph);
    sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z;
    sOrig[i * 3] = x; sOrig[i * 3 + 1] = y; sOrig[i * 3 + 2] = z;
    sSz[i] = 0.02 + Math.random() * 0.16;
  }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSz, 1));
  sGeo.setAttribute('aOrigin', new THREE.BufferAttribute(sOrig, 3));

  const sMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSpeed: { value: 0 },
      uConverge: { value: 0 },
      uProgress: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 aOrigin;
      uniform float uTime, uSpeed, uConverge, uProgress;
      varying float vA; varying float vB;
      void main() {
        vec3 pos = aOrigin;
        // Converge toward forward axis (-Z) as we progress through tunnel
        // Pull stars toward viewing center based on convergence factor
        float dist = length(pos.xy);
        float convergeAmt = uConverge * (1.0 / max(dist * 0.1, 0.01));
        convergeAmt = clamp(convergeAmt, 0.0, 1.5);
        // Pull XY toward 0, push Z backward (stars form tunnel walls)
        pos.xy *= (1.0 - convergeAmt * 0.7);
        // Stars further from center get pulled more → tunnel formation
        pos.z -= convergeAmt * 40.0;

        // Also pull stars toward forward axis
        float forwardPull = uConverge * 2.0;
        pos.x *= (1.0 - forwardPull * 0.15);
        pos.y *= (1.0 - forwardPull * 0.15);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (1.0 + uConverge * 2.0) * (80.0 / max(-mv.z, 0.1)), 0.2, 3.5);
        vA = 0.45 + 0.55 * sin(uTime * (1.0 + aSize * 6.0) + pos.x * 0.03);
        vB = uConverge; // how close to throat
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vB;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.5) * vA * (0.5 + vB * 0.5);
        gl_FragColor = vec4(vec3(0.8, 0.85, 1.0), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const starField = new THREE.Points(sGeo, sMat);
  scene.add(starField);

  // ══════════════ FLOW PARTICLES (white dots in tunnel) ══════════════
  const pCount = Math.floor(perf.particleBudget * 0.4);
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pSz = new Float32Array(pCount);
  const pPh = new Float32Array(pCount);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 0.3 + Math.random() * (TR - 0.5);
    pPos[i * 3] = Math.cos(a) * d;
    pPos[i * 3 + 1] = Math.sin(a) * d;
    pPos[i * 3 + 2] = -Math.random() * TL;
    pSz[i] = Math.random() * 0.1 + 0.01;
    pPh[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSz, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPh, 1));
  const pUni = { uTime: { value: 0 }, uSpeed: { value: 0 }, uTL: { value: TL } };
  const pMat = new THREE.ShaderMaterial({
    uniforms: pUni,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      uniform float uTime, uSpeed, uTL;
      varying float vA;
      void main() {
        vec3 pos = position;
        pos.z = mod(pos.z - uTime * uSpeed * 6.0, -uTL);
        float df = -pos.z / uTL;
        float dt = abs(df - 0.5);
        float rm = 1.0 - (1.0 - exp(-dt * dt / 0.006)) * 0.88;
        pos.x *= rm; pos.y *= rm;
        float tw = df * 2.5 + uTime * uSpeed * 0.2;
        float o = pos.x; pos.x = o * cos(tw) - pos.y * sin(tw);
        pos.y = o * sin(tw) + pos.y * cos(tw);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp(aSize * (140.0 / max(-mv.z, 0.1)), 0.15, 3.0);
        vA = (1.0 - smoothstep(0.9, 1.0, df)) * (0.3 + exp(-dt * dt / 0.004) * 0.7);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0) * vA * 0.55;
        gl_FragColor = vec4(vec3(0.75, 0.8, 0.9), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // ══════════════ ENTRANCE / EXIT RINGS ══════════════
  const rGeo = new THREE.TorusGeometry(TR, 0.18, 16, 140);
  const entranceRing = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x334466, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  entranceRing.position.z = 0.5; scene.add(entranceRing);

  const exitRing = new THREE.Mesh(rGeo.clone(), new THREE.MeshBasicMaterial({
    color: 0x665544, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  exitRing.position.z = -TL * 0.48; exitRing.scale.set(0.15, 0.15, 1); scene.add(exitRing);

  // ══════════════ SKY BACKGROUNDS ══════════════
  const skyGeo = new THREE.SphereGeometry(130, 40, 40);
  const earthSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.4 } },
    vertexShader: `varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 p; uniform float uTime, uAlpha;
      void main(){ float h=p.y/130.0; float a=smoothstep(0.06,0.6,h)*uAlpha;
      gl_FragColor=vec4(mix(vec3(0.015,0.04,0.16),vec3(0.008,0.02,0.08),smoothstep(0.12,0.35,h)),a); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  const earthSky = new THREE.Mesh(skyGeo, earthSkyMat); scene.add(earthSky);

  const moonSkyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: earthSkyMat.vertexShader,
    fragmentShader: `varying vec3 p; uniform float uTime, uAlpha;
      void main(){ float a=smoothstep(0.06,0.4,-p.y/130.0)*uAlpha;
      gl_FragColor=vec4(vec3(0.06,0.05,0.03),a); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo.clone(), moonSkyMat));

  // ══════════════ STATE ══════════════
  let baseSpeed = 1.5, curSpeed = baseSpeed, tgtSpeed = baseSpeed;
  let boosting = false, boostTimer = null;
  let traveled = 0;
  const totalDist = 384400;
  let arriving = false, arrCB = null, arrP = 0;
  let gyr = false, gBeta = 0, gGamma = 0;
  let tYaw = 0, tPitch = 0, cYaw = 0, cPitch = 0, cRoll = 0;
  let pDown = false, lpx = 0, lpy = 0;

  function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') { gyr = true; window.addEventListener('deviceorientation', od); } }).catch(() => {});
    } else if ('ondeviceorientation' in window) { gyr = true; window.addEventListener('deviceorientation', od); }
  }
  function od(e) { if (!gyr) return; gBeta = e.beta || 0; gGamma = e.gamma || 0; tPitch = (gGamma / 90) * 0.18; tYaw = (gBeta / 180) * 0.22; }

  // Smoothstep helper
  const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // ══════════════ UPDATE ══════════════
  function update(dt) {
    if (arriving) {
      arrP = Math.min(1, arrP + dt * 0.45);
      curSpeed = baseSpeed * (1 - arrP);
      traveled += curSpeed * 200 * dt; // slow final approach
      if (arrP >= 1 && arrCB) { arrCB(); arrCB = null; return { progress: 1, phys: physics.evaluate(1) }; }
      return { progress: Math.min(traveled / totalDist, 1), phys: physics.evaluate(Math.min(traveled / totalDist, 1)) };
    }

    curSpeed += (tgtSpeed - curSpeed) * 3.5 * dt;
    traveled += curSpeed * 30000 * dt;
    const progress = Math.min(traveled / totalDist, 1);
    const phys = physics.evaluate(progress);

    // Camera
    if (gyr) { cPitch += (tPitch - cPitch) * 5 * dt; cYaw += (tYaw - cYaw) * 5 * dt; }
    else {
      const t = performance.now() * 0.001;
      tPitch = Math.sin(t * 0.18) * 0.05 + Math.sin(t * 5.5) * phys.shake * 1.5;
      tYaw = Math.cos(t * 0.16) * 0.04 + Math.cos(t * 4.5) * phys.shake * 1.5;
      cPitch += (tPitch - cPitch) * 2 * dt; cYaw += (tYaw - cYaw) * 2 * dt;
    }
    camera.rotation.set(cPitch, cYaw, cRoll);

    // FOV — wider at high speed
    const fovT = 78 + curSpeed * 3 + (boosting ? 6 : 0);
    camera.fov += (fovT - camera.fov) * 2 * dt;
    camera.updateProjectionMatrix();

    // Uniforms
    const now = performance.now() * 0.001;
    tUni.uTime.value = now;
    tUni.uSpeed.value = curSpeed * phys.speedMul;
    tUni.uDopplerShift.value = phys.doppler;
    tUni.uRingIntensity.value = phys.ringIntensity;
    tUni.uLensingStrength.value = phys.lensing;
    tUni.uWallDistortion.value = phys.wallDistortion;
    tUni.uProgress.value = progress;
    const boostGlow = boosting ? 1.2 : 0.85;
    tUni.uGlowIntensity.value += (boostGlow - tUni.uGlowIntensity.value) * 4 * dt;
    pUni.uTime.value = now;
    pUni.uSpeed.value = curSpeed * phys.speedMul;

    // ═══ STAR CONVERGENCE ═══
    // Stars warp toward center → form tunnel walls
    sMat.uniforms.uTime.value = now;
    sMat.uniforms.uSpeed.value = curSpeed;
    sMat.uniforms.uConverge.value = phys.lensing * 0.4 + phys.wallDistortion * 0.6;
    sMat.uniforms.uProgress.value = progress;

    // Rings
    entranceRing.material.opacity = Math.max(0, 1 - progress * 6) * 0.3;
    const es = sm(0.6, 0.95, progress); exitRing.scale.set(0.15 + es * 0.85, 0.15 + es * 0.85, 1);
    exitRing.material.opacity = es * 0.3;

    // Sky
    earthSkyMat.uniforms.uAlpha.value = (1 - sm(0.02, 0.22, progress)) * 0.4;
    moonSkyMat.uniforms.uAlpha.value = sm(0.68, 0.92, progress) * 0.4;

    return { progress, phys };
  }

  // ══════════════ INPUT ══════════════
  function onPointerDown(e) {
    pDown = true; lpx = e.clientX || e.touches?.[0]?.clientX || 0;
    lpy = e.clientY || e.touches?.[0]?.clientY || 0;
  }
  function onPointerMove(e) {
    if (!pDown) return;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    tYaw += (cx - lpx) * 0.002; tPitch += (cy - lpy) * 0.002;
    tPitch = Math.max(-0.35, Math.min(0.35, tPitch));
    tYaw = Math.max(-0.45, Math.min(0.45, tYaw));
    lpx = cx; lpy = cy;
  }
  function onPointerUp() { pDown = false; }
  function triggerBoost() { if (boosting) return; boosting = true; tgtSpeed = baseSpeed * 3.0; if (boostTimer) clearTimeout(boostTimer); boostTimer = setTimeout(() => { boosting = false; tgtSpeed = baseSpeed; }, 2800); }
  function endBoost() { if (boostTimer) clearTimeout(boostTimer); boosting = false; tgtSpeed = baseSpeed; }

  return {
    scene, camera, physics,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    start() { traveled = 0; tgtSpeed = baseSpeed; enableGyro(); },
    update,
    getProgress() { return Math.min(traveled / totalDist, 1); },
    getTraveled() { return traveled; }, getTotalDistance() { return totalDist; },
    getPhys() { return physics.evaluate(Math.min(traveled / totalDist, 1)); },
    startArrival(cb) { if (arriving) return; arriving = true; arrCB = cb; arrP = 0; },
    triggerBoost, isBoostActive() { return boosting; },
    setBaseSpeed(s) { baseSpeed = s; if (!boosting) tgtSpeed = s; },
    getSpeed() { return curSpeed; },
    onPointerDown, onPointerMove, onPointerUp,
    dispose() {
      if (boostTimer) clearTimeout(boostTimer);
      window.removeEventListener('deviceorientation', od);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
    },
  };
}
