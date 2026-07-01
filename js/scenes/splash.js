// Splash — Earth 10km altitude wormhole entrance
// Returns { scene, camera, startTransition, dispose } — NO renderer
import * as THREE from 'three';

export function createSplashScene(perf) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 1, 16);
  camera.lookAt(0, -2, 0);

  // ══════ STARS ══════
  const starCount = perf.starCount;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSz = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 60;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i * 3 + 2] = r * Math.cos(ph);
    starSz[i] = 0.02 + Math.random() * 0.1;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSz, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; uniform float uTime; varying float vT;
      void main(){ vec4 m=modelViewMatrix*vec4(position,1.0);
      vT=0.5+0.5*sin(uTime*(1.0+aSize*6.0)+position.x*0.05);
      gl_PointSize=aSize*vT*(60.0/max(-m.z,0.1)); gl_Position=projectionMatrix*m; }`,
    fragmentShader: `varying float vT;
      void main(){ float d=length(gl_PointCoord-0.5)*2.0;
      gl_FragColor=vec4(vec3(0.85,0.88,1.0),pow(1.0-smoothstep(0.0,1.0,d),2.5)*vT*0.65); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ══════ EARTH (visible below portal) ══════
  const earthGeo = new THREE.SphereGeometry(22, 72, 72);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP;
      void main(){ vN=normalize(normalMatrix*normal); vP=position;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float uTime;
      void main(){
        vec3 vd=normalize(vec3(0,-1,0.3));
        float atmo=pow(1.0-abs(dot(vd,vN)),6.0);
        float h=smoothstep(-22.0,5.0,vP.y);
        vec3 col=mix(vec3(0.02,0.04,0.18),vec3(0.08,0.15,0.5),h*atmo*0.7);
        gl_FragColor=vec4(col,smoothstep(-15.0,8.0,vP.y)*0.55);
      }`,
    transparent: true, depthWrite: false,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.position.set(0, -28, -8);
  scene.add(earth);

  // ══════ WORMHOLE PORTAL ══════
  const portal = new THREE.Group();

  // Main ring
  const ringGeo = new THREE.TorusGeometry(2.6, 0.13, 40, 180);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 u; void main(){ u=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 u; uniform float uTime;
      void main(){ float p=0.55+0.45*sin(u.x*6.28318*2.0+uTime*2.0);
      float e=1.0-abs(u.y-0.5)*2.0; gl_FragColor=vec4(vec3(0.55,0.7,1.0)*p,e*0.5*p); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  portal.add(new THREE.Mesh(ringGeo, ringMat));

  // Dark center disc (throat opening)
  const discGeo = new THREE.CircleGeometry(2.2, 64);
  const discMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 u; void main(){ u=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 u; uniform float uTime;
      void main(){ float d=length(u-0.5)*2.0;
      gl_FragColor=vec4(mix(vec3(0.005,0.01,0.03),vec3(0.015,0.03,0.1),d),
        smoothstep(1.0,0.8,d)*0.75); }`,
    transparent: true, depthWrite: false,
  });
  portal.add(new THREE.Mesh(discGeo, discMat));

  portal.position.set(0, 0, -2);
  scene.add(portal);

  // ══════ ANIMATION ══════
  let playing = false, transP = 0, transCB = null, elapsed = 0;

  function update(dt) {
    elapsed += dt;
    const t = elapsed;

    portal.rotation.z += 0.0012 * dt * 60;
    portal.rotation.y += 0.0008 * dt * 60;
    ringMat.uniforms.uTime.value = t;
    discMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;

    if (playing && transP < 1) {
      transP = Math.min(1, transP + dt * 0.35);
      const e = 1 - Math.pow(1 - transP, 3.5);
      camera.fov = 52 + e * 85;
      camera.updateProjectionMatrix();
      portal.scale.setScalar(1 + e * 4);
      portal.position.z = -2 - e * 6;
      if (transP >= 1 && transCB) { transCB(); transCB = null; }
    }
  }

  return {
    scene, camera, update,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    startTransition(cb) { playing = true; transP = 0; transCB = cb; },
    dispose() {
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
    },
  };
}
