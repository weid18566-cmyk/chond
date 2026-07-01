// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  WORMHOLE ENTRANCE PORTAL — Earth 10km altitude                       ║
// ║  Spherical portal in deep space, Earth curve below, stars above        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';

export function createSplashScene(canvas, perf) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);

  // ══════════════ STAR FIELD (deep space) ══════════════
  const starGeo = new THREE.BufferGeometry();
  const starCount = perf.starCount;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 70 + Math.random() * 60;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starSizes[i] = 0.03 + Math.random() * 0.12;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; uniform float uTime; varying float vT;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
      vT=0.5+0.5*sin(uTime*(1.0+aSize*8.0)+position.x*0.04);
      gl_PointSize=aSize*vT*(70.0/max(-mv.z,0.1)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vT;
      void main(){ float d=length(gl_PointCoord-0.5)*2.0;
      float a=pow(1.0-smoothstep(0.0,1.0,d),2.5)*vT*0.7;
      gl_FragColor=vec4(vec3(0.85,0.88,1.0),a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ══════════════ EARTH BODY (visible below, 10000km altitude) ══════════════
  // Large sphere below the portal showing Earth's curvature
  const earthGeo = new THREE.SphereGeometry(20, 64, 64);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP;
      void main(){ vN=normalize(normalMatrix*normal); vP=position;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float uTime;
      void main(){
        vec3 vd=normalize(vec3(0,0,1));
        float f=1.0-abs(dot(vd,vN));
        // Earth atmosphere: deep blue at horizon → dark at zenith
        float h = smoothstep(-20.0, -2.0, vP.y);
        float atmo = pow(1.0 - abs(dot(vd, vN)), 6.0) * 0.7;
        vec3 ocean = mix(vec3(0.04,0.08,0.25), vec3(0.1,0.2,0.6), h * atmo);
        vec3 col = mix(ocean, vec3(0.02,0.03,0.15), h * 0.5);
        float alpha = smoothstep(-15.0, 0.0, vP.y) * 0.6;
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true, depthWrite: false,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.position.set(0, -25, -5);
  scene.add(earth);

  // ══════════════ WORMHOLE PORTAL RINGS ══════════════
  const ringGroup = new THREE.Group();

  // Main event horizon ring
  const mainRingGeo = new THREE.TorusGeometry(2.5, 0.12, 40, 160);
  const mainRingMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float pulse=0.6+0.4*sin(vUv.x*6.28318*2.5+uTime*2.0);
        float edge=1.0-abs(vUv.y-0.5)*2.0;
        gl_FragColor=vec4(vec3(0.6,0.75,1.0)*pulse,edge*0.5*pulse);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mainRing = new THREE.Mesh(mainRingGeo, mainRingMat);
  mainRing.rotation.x = Math.PI * 0.5;
  ringGroup.add(mainRing);

  // Secondary ring (outer)
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.9, 0.05, 20, 120),
    new THREE.MeshBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.3 })
  );
  outerRing.rotation.x = Math.PI * 0.5;
  ringGroup.add(outerRing);

  ringGroup.position.z = -2;
  scene.add(ringGroup);

  // ══════════════ PORTAL CENTER (dark opening into wormhole) ══════════════
  const portalDiscGeo = new THREE.CircleGeometry(2.2, 64);
  const portalDiscMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vP;
      void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vP; uniform float uTime;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float alpha = smoothstep(1.0, 0.85, d) * 0.8;
        // Dark center fading to transparent at edges
        vec3 col = mix(vec3(0.01,0.015,0.04), vec3(0.02,0.04,0.12), smoothstep(0.0, 1.0, d));
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true, depthWrite: false,
  });
  const portalDisc = new THREE.Mesh(portalDiscGeo, portalDiscMat);
  portalDisc.position.z = -2.01;
  scene.add(portalDisc);

  // ══════════════ TRANSITION STATE ══════════════
  let isPlaying = false;
  let transitionProgress = 0;
  let transitionCallback = null;
  let rafId = null;
  let stopped = false;

  function animate(time) {
    if (stopped) return;
    rafId = requestAnimationFrame(animate);
    const t = time * 0.001;

    ringGroup.rotation.z += 0.0015;
    ringGroup.rotation.y += 0.001;
    mainRingMat.uniforms.uTime.value = t;
    portalDiscMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    earthMat.uniforms.uTime.value = t;

    stars.rotation.y += 0.00006;
    stars.rotation.x += 0.00003;

    if (isPlaying && transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + 0.006);
      const ease = 1 - Math.pow(1 - transitionProgress, 3.5);

      camera.fov = 52 + ease * 80;
      camera.updateProjectionMatrix();
      ringGroup.scale.setScalar(1 + ease * 5);
      ringGroup.position.z = -2 - ease * 7;
      renderer.toneMappingExposure = 1.1 + ease * 2.0;

      if (transitionProgress >= 1 && transitionCallback) {
        transitionCallback(); transitionCallback = null;
      }
    }

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  return {
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); },
    addTrailPoint(x, y) {},
    startTransition(cb) { isPlaying = true; transitionProgress = 0; transitionCallback = cb; },
    dispose() {
      stopped = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      renderer.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); }
      });
    },
  };
}
