// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR WORMHOLE APP ORCHESTRATOR v2.0                           ║
// ║  Scene state machine, physics-driven HUD, cinematic overlays          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import { detectPerformance } from './utils/perf.js';
import { createSplashScene } from './scenes/splash.js';
import { createFlightScene } from './scenes/flight.js';
import { createArrivalScene } from './scenes/arrival.js';
import { WORMHOLE_DB } from './utils/physics.js';
import {
  audioInit, audioToggle, audioSetMuted, audioIsMuted, audioOnChange,
  startWormholeHum, updateFlightAudio, stopAllAudio,
  playSingularityPass, playArrivalChime, playQuantumBoost, triggerHaptic
} from './audio.js';
import { shareStellarCoordinates } from './utils/share.js';

const SCENES = { SPLASH: 'SPLASH', FLYING: 'FLYING', ARRIVAL: 'ARRIVAL' };

function formatNumber(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0); }
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function createApp() {
  const canvas = document.getElementById('main-canvas');
  const uiLayer = document.getElementById('ui-layer');
  const loadingScreen = document.getElementById('loading-screen');

  const perf = detectPerformance();
  let currentSceneName = null;
  let currentSceneInstance = null;
  let animationId = null;
  let reducedMotion = localStorage.getItem('wormhole-reduced-motion') === 'true';
  if (reducedMotion) document.body.classList.add('reduced-motion');

  setTimeout(() => { loadingScreen.classList.add('hidden'); }, 500);

  // ── Resize ──
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    if (currentSceneInstance?.resize) currentSceneInstance.resize(w, h);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

  // ── Centralized input ──
  let boostPressStart = 0, boostCheckActive = false, boostActive = false, boostHintEl = null;
  let flightStartTime = 0;
  let activeKeyHandler = null;  // tracked so we can remove it on scene change

  canvas.addEventListener('pointerdown', (e) => {
    if (currentSceneInstance?.onPointerDown) currentSceneInstance.onPointerDown(e);
    if (currentSceneName === SCENES.FLYING) { boostPressStart = performance.now(); boostCheckActive = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (currentSceneInstance?.onPointerMove) currentSceneInstance.onPointerMove(e);
    if (currentSceneInstance?.addTrailPoint && currentSceneName === SCENES.SPLASH) {
      currentSceneInstance.addTrailPoint(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (currentSceneInstance?.onPointerUp) currentSceneInstance.onPointerUp();
    if (currentSceneName === SCENES.FLYING) { boostCheckActive = false; if (boostActive) { currentSceneInstance.endBoost?.(); boostActive = false; rbh(); } }
  });
  canvas.addEventListener('pointerleave', () => {
    if (currentSceneInstance?.onPointerUp) currentSceneInstance.onPointerUp();
    if (currentSceneName === SCENES.FLYING) { boostCheckActive = false; if (boostActive) { currentSceneInstance.endBoost?.(); boostActive = false; rbh(); } }
  });
  canvas.addEventListener('wheel', (e) => { if (currentSceneInstance?.onWheel) currentSceneInstance.onWheel(e); });

  function rbh() { if (boostHintEl) { boostHintEl.textContent = '长按屏幕 · 量子推进'; boostHintEl.style.color = '#8899bb'; } }

  // ── Transition ──
  function transitionTo(targetScene, data = {}) {
    uiLayer.innerHTML = '';
    if (activeKeyHandler) { window.removeEventListener('keydown', activeKeyHandler); activeKeyHandler = null; }
    if (currentSceneInstance?.dispose) currentSceneInstance.dispose();
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    stopAllAudio(); boostActive = false; boostCheckActive = false; boostHintEl = null;
    currentSceneName = targetScene;
    switch (targetScene) {
      case SCENES.SPLASH: buildSplash(); break;
      case SCENES.FLYING: buildFlight(data); break;
      case SCENES.ARRIVAL: buildArrival(data); break;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  SPLASH SCENE
  // ════════════════════════════════════════════════════════════
  function buildSplash() {
    currentSceneInstance = createSplashScene(canvas, perf);

    const container = document.createElement('div');
    container.className = 'splash-container';

    const title = document.createElement('h1');
    title.className = 'splash-title';
    title.innerHTML = '触碰虫洞，开启穿越<span>地球 → 月球 // WORMHOLE TRANSIT</span>';
    container.appendChild(title);

    // ── Science note ──
    const note = document.createElement('p');
    note.style.cssText = 'color:#5a6a88;font-size:0.6rem;letter-spacing:0.08em;text-align:center;margin-bottom:24px;font-family:"Space Grotesk",sans-serif;line-height:1.6;max-width:320px;';
    note.textContent = '基于 Morris-Thorne 度规的虫洞穿越模拟\n包含引力透镜、多普勒偏移、光子球效应';
    container.appendChild(note);

    const actions = document.createElement('div');
    actions.className = 'splash-actions';

    const launchBtn = document.createElement('button');
    launchBtn.className = 'btn-cosmic btn-cosmic-primary';
    launchBtn.innerHTML = '<span class="material-symbols-outlined">rocket_launch</span> 启动虫洞穿越';
    launchBtn.setAttribute('aria-label', '启动虫洞穿越：地球到月球');
    launchBtn.addEventListener('click', () => {
      triggerHaptic('heavy'); audioInit(); audioSetMuted(true);
      currentSceneInstance.startTransition(() => { transitionTo(SCENES.FLYING); });
    });
    actions.appendChild(launchBtn);

    const motionLabel = document.createElement('label');
    motionLabel.style.cssText = 'display:flex;align-items:center;gap:8px;color:#8899bb;font-size:0.7rem;cursor:pointer;letter-spacing:0.05em;';
    const motionCheck = document.createElement('input');
    motionCheck.type = 'checkbox'; motionCheck.checked = reducedMotion;
    motionCheck.style.cssText = 'accent-color:#00f0ff;';
    motionCheck.addEventListener('change', () => {
      reducedMotion = motionCheck.checked;
      localStorage.setItem('wormhole-reduced-motion', String(reducedMotion));
      document.body.classList.toggle('reduced-motion', reducedMotion);
    });
    motionLabel.appendChild(motionCheck);
    motionLabel.appendChild(document.createTextNode('减少动态效果'));
    actions.appendChild(motionLabel);

    container.appendChild(actions);
    uiLayer.appendChild(container);
  }

  // ════════════════════════════════════════════════════════════
  //  FLIGHT SCENE
  // ════════════════════════════════════════════════════════════
  function buildFlight(data) {
    currentSceneInstance = createFlightScene(canvas, perf);
    currentSceneInstance.start();
    flightStartTime = performance.now() * 0.001;

    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}

    // ── Cinematic Letterbox Bars ──
    const letterTop = document.createElement('div');
    letterTop.className = 'cinematic-letterbox top';
    uiLayer.appendChild(letterTop);
    const letterBottom = document.createElement('div');
    letterBottom.className = 'cinematic-letterbox bottom';
    uiLayer.appendChild(letterBottom);

    // ── Vignette ──
    uiLayer.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));

    // ── 2D Wormhole Schematic ──
    const schematic = document.createElement('div');
    schematic.id = 'wormhole-schematic';
    schematic.style.cssText = 'position:fixed;top:calc(24px + env(safe-area-inset-top,0));right:16px;width:130px;height:90px;z-index:35;';
    const schCanvas = document.createElement('canvas');
    schCanvas.width = 130; schCanvas.height = 90;
    schCanvas.style.cssText = 'width:130px;height:90px;border-radius:10px;background:rgba(6,8,13,0.6);border:1px solid rgba(0,240,255,0.12);box-shadow:0 0 20px rgba(0,240,255,0.08);';
    schematic.appendChild(schCanvas);
    const schLabel = document.createElement('div');
    schLabel.style.cssText = 'color:#667799;font-size:0.48rem;text-align:center;letter-spacing:0.06em;margin-top:3px;font-family:"JetBrains Mono",monospace;';
    schLabel.textContent = 'MORRIS-THORNE EMBEDDING';
    schematic.appendChild(schLabel);
    uiLayer.appendChild(schematic);

    // ── HUD Top Bar ──
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'btn-icon';
    muteBtn.setAttribute('aria-label', '切换音效');
    function updateMuteIcon(m) { muteBtn.innerHTML = m ? '<span class="material-symbols-outlined">volume_off</span>' : '<span class="material-symbols-outlined">volume_up</span>'; }
    updateMuteIcon(true);
    muteBtn.addEventListener('click', () => { const m = audioToggle(); updateMuteIcon(m); m ? stopAllAudio() : startWormholeHum(); triggerHaptic('light'); });
    audioOnChange(updateMuteIcon);
    topBar.appendChild(muteBtn);

    // ── Speed indicator ──
    const speedEl = document.createElement('div');
    speedEl.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:0.6rem;color:#00f0ff;letter-spacing:0.1em;text-shadow:0 0 10px rgba(0,240,255,0.5);';
    speedEl.textContent = '1.0x';
    topBar.appendChild(speedEl);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-text'; skipBtn.textContent = '跳过';
    skipBtn.setAttribute('aria-label', '跳过虫洞穿越');
    skipBtn.addEventListener('click', () => { triggerHaptic('light'); stopAllAudio(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); transitionTo(SCENES.ARRIVAL, { skipped: true }); });
    topBar.appendChild(skipBtn);
    uiLayer.appendChild(topBar);

    // ── Physics HUD (left) ──
    const physHUD = document.createElement('div');
    physHUD.id = 'physics-hud';
    physHUD.style.cssText = 'position:fixed;left:16px;top:25%;z-index:35;font-family:"JetBrains Mono",monospace;font-size:0.52rem;color:#667799;pointer-events:none;line-height:1.8;text-shadow:0 0 6px rgba(0,240,255,0.2);';
    uiLayer.appendChild(physHUD);

    // ── Right-side telemetry ──
    const telemetryHUD = document.createElement('div');
    telemetryHUD.style.cssText = 'position:fixed;right:16px;top:35%;z-index:35;font-family:"JetBrains Mono",monospace;font-size:0.48rem;color:#556688;pointer-events:none;line-height:1.9;text-align:right;';
    uiLayer.appendChild(telemetryHUD);

    // ── Progress bar ──
    const progContainer = document.createElement('div');
    progContainer.className = 'progress-container';
    progContainer.innerHTML = `
      <div class="progress-label"><span id="prog-loc-label">地球近地轨道</span><span id="prog-distance">0 km</span></div>
      <div class="progress-track">
        <div class="progress-fill" id="prog-fill" style="width:0%"></div>
        <div class="progress-marker" id="prog-marker-throat" style="left:50%"></div>
      </div>`;
    uiLayer.appendChild(progContainer);

    // ── Boost hint ──
    boostHintEl = document.createElement('div');
    boostHintEl.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);color:#667799;font-size:0.6rem;letter-spacing:0.1em;z-index:30;font-family:"Space Grotesk",sans-serif;transition:color 0.3s ease;';
    boostHintEl.textContent = '长按屏幕 · 量子推进';
    uiLayer.appendChild(boostHintEl);

    // ── Center warning flash (for throat passage) ──
    const centerFlash = document.createElement('div');
    centerFlash.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:none;background:radial-gradient(circle at center,rgba(255,255,255,0) 0%,rgba(255,255,255,0) 100%);transition:background 0.3s ease;';
    uiLayer.appendChild(centerFlash);

    const progFill = document.getElementById('prog-fill');
    const distEl = document.getElementById('prog-distance');
    const locLabel = document.getElementById('prog-loc-label');
    let hasPassedThroat = false;
    let hasEnteredPhotonSphere = false;
    let lastTime = performance.now();

    function flightLoop() {
      const now = performance.now();
      let dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;

      // Boost detection
      if (boostCheckActive && !boostActive && (now - boostPressStart) > 500) {
        boostActive = true; currentSceneInstance.triggerBoost();
        playQuantumBoost(); triggerHaptic('boost');
        boostHintEl.textContent = '量子推进中 ···'; boostHintEl.style.color = '#00f0ff';
      }

      const result = currentSceneInstance.update(dt);
      const progress = result.progress;
      const phys = result.phys;
      const speed = currentSceneInstance.getSpeed();
      const traveled = currentSceneInstance.getTraveled();
      const elapsed = (performance.now() * 0.001) - flightStartTime;

      // ── Update speed indicator (in fractions of c) ──
      speedEl.textContent = (speed / 1.6).toFixed(1) + 'c';

      // Progress bar
      progFill.style.width = (progress * 100) + '%';
      if (distEl) distEl.textContent = formatNumber(traveled) + ' km';
      if (locLabel) {
        const loc = currentSceneInstance.physics.getLocationInfo(progress);
        locLabel.textContent = loc.label;
      }

      // ── Physics HUD ──
      const gamma = phys.gamma || (1 / Math.sqrt(Math.max(0.01, 1 - speed * 0.01)));
      const timeDilation = (1 / gamma).toFixed(4);
      const redshift = (phys.gravitationalRedshift != null) ? (phys.gravitationalRedshift * 100).toFixed(1) : '0.0';

      if (physHUD) {
        physHUD.innerHTML = `
          <span style="color:#446688">═══ 相对论参数 ═══</span><br>
          时间膨胀  <span style="color:#88aacc">${timeDilation}τ</span><br>
          引力红移  <span style="color:${parseFloat(redshift) > 50 ? '#ff6644' : '#88aacc'}">${redshift}%</span><br>
          洛伦兹γ   <span style="color:#88aacc">${gamma.toFixed(2)}</span><br><br>
          <span style="color:#446688">═══ 潮汐应力 ═══</span><br>
          径向力    <span style="color:${(phys.tidalRadial || phys.tidal) > 1 ? '#ff8844' : '#88aacc'}">${((phys.tidalRadial || phys.tidal) * 100).toFixed(1)}</span> N/kg<br>
          切向力    <span style="color:#88aacc">${((phys.tidalTangential || phys.tidal * 0.7) * 100).toFixed(1)}</span> N/kg<br>
          多普勒    <span style="color:${phys.doppler > 0 ? '#ff8844' : '#4488ff'}">${phys.doppler > 0 ? '+' : ''}${(phys.doppler * 100).toFixed(1)}%</span><br><br>
          <span style="color:#446688">═══ 虫洞几何 ═══</span><br>
          喉部半径  <span style="color:#88aacc">${phys.radius.toFixed(3)} r₀</span><br>
          曲率     <span style="color:#88aacc">${(phys.curvature || 0).toFixed(4)}</span><br>
          坐标距离  <span style="color:#88aacc">${(progress * 100).toFixed(1)}%</span>
        `;
      }

      // ── Telemetry (right side) ──
      if (telemetryHUD) {
        telemetryHUD.innerHTML = `
          穿越用时  ${formatTime(elapsed)}<br>
          速度      ${(speed * 8000).toLocaleString()} km/s<br>
          已行进    ${formatNumber(traveled)} km<br>
          剩余      ${formatNumber(384400 - traveled)} km<br>
          光子球    <span style="color:${phys.photonSphere > 0.3 ? '#ffaa44' : '#556688'}">${(phys.photonSphere || 0).toFixed(2)}</span><br>
          透镜强度  ${(phys.lensing).toFixed(2)}<br>
          框架拖曳  <span style="color:${Math.abs(phys.frameDrag || 0) > 0.1 ? '#aa88ff' : '#556688'}">${(phys.frameDrag || 0).toFixed(3)}</span>
        `;
      }

      // ── 2D Schematic ──
      drawSchematic(schCanvas, progress);

      // ── Audio ──
      updateFlightAudio(speed / 2, progress);

      // ── Photon sphere entry event ──
      if (progress >= 0.40 && !hasEnteredPhotonSphere) {
        hasEnteredPhotonSphere = true;
        centerFlash.style.background = 'radial-gradient(circle at center, rgba(100,140,255,0.15) 0%, transparent 70%)';
        setTimeout(() => { centerFlash.style.background = 'radial-gradient(circle at center, rgba(100,140,255,0) 0%, transparent 100%)'; }, 800);
      }

      // ── Throat passage event ──
      if (progress >= 0.48 && !hasPassedThroat) {
        hasPassedThroat = true;
        playSingularityPass(); triggerHaptic('heavy');
        centerFlash.style.background = 'radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 60%)';
        setTimeout(() => { centerFlash.style.background = 'radial-gradient(circle at center, rgba(255,255,255,0) 0%, transparent 100%)'; }, 600);
        if (!boostActive) { boostHintEl.textContent = '穿越喉部 · 奇点'; boostHintEl.style.color = '#ffcc44'; }
      }

      // ── Exit approach ──
      if (progress >= 0.85) {
        if (!boostActive) { boostHintEl.textContent = '即将抵达月球 ···'; boostHintEl.style.color = '#ff8844'; }
      }

      if (progress >= 1) {
        currentSceneInstance.startArrival(() => {
          stopAllAudio();
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          transitionTo(SCENES.ARRIVAL, { elapsed });
        });
      }

      animationId = requestAnimationFrame(flightLoop);
    }
    animationId = requestAnimationFrame(flightLoop);

    // ── Keyboard shortcuts (tracked for cleanup) ──
    function handleKey(e) {
      if (currentSceneName !== SCENES.FLYING) return;
      if (e.key === 'ArrowRight') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 1.5);
      if (e.key === 'ArrowLeft') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 0.7);
      if (e.key === ' ') { e.preventDefault(); currentSceneInstance.triggerBoost(); playQuantumBoost(); }
    }
    activeKeyHandler = handleKey;
    window.addEventListener('keydown', handleKey);
  }

  // ════════════════════════════════════════════════════════════
  //  2D WORMHOLE SCHEMATIC
  // ════════════════════════════════════════════════════════════
  function drawSchematic(canvas, progress) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(4, 6, 12, 0.9)';
    ctx.fillRect(0, 0, w, h);

    const ax = 12, ay = h / 2;
    const bx = w - 12, by = h / 2;
    const midX = (ax + bx) / 2;

    // ── Embedding diagram (proper hourglass shape) ──
    // Draw both upper and lower curves
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let x = ax; x <= bx; x += 1) {
      const t = (x - ax) / (bx - ax);
      const distFromThroat = Math.abs(t - 0.5);
      const throatFactor = 1 - Math.exp(-distFromThroat * distFromThroat / 0.01);
      const r = 25 * (0.15 + 0.85 * throatFactor);
      ctx.lineTo(x, ay - r);
    }
    ctx.strokeStyle = progress < 0.5 ? 'rgba(0,180,255,0.5)' : 'rgba(0,180,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let x = ax; x <= bx; x += 1) {
      const t = (x - ax) / (bx - ax);
      const distFromThroat = Math.abs(t - 0.5);
      const throatFactor = 1 - Math.exp(-distFromThroat * distFromThroat / 0.01);
      const r = 25 * (0.15 + 0.85 * throatFactor);
      ctx.lineTo(x, ay + r);
    }
    ctx.strokeStyle = progress < 0.5 ? 'rgba(0,180,255,0.5)' : 'rgba(0,180,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Exit side (orange)
    ctx.beginPath();
    ctx.moveTo(midX, ay - 4);
    for (let x = midX; x <= bx; x += 1) {
      const t = (x - ax) / (bx - ax);
      const distFromThroat = Math.abs(t - 0.5);
      const throatFactor = 1 - Math.exp(-distFromThroat * distFromThroat / 0.01);
      const r = 25 * (0.15 + 0.85 * throatFactor);
      ctx.lineTo(x, ay - r);
    }
    ctx.strokeStyle = progress > 0.5 ? 'rgba(255,136,0,0.5)' : 'rgba(255,136,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, ay + 4);
    for (let x = midX; x <= bx; x += 1) {
      const t = (x - ax) / (bx - ax);
      const distFromThroat = Math.abs(t - 0.5);
      const throatFactor = 1 - Math.exp(-distFromThroat * distFromThroat / 0.01);
      const r = 25 * (0.15 + 0.85 * throatFactor);
      ctx.lineTo(x, ay + r);
    }
    ctx.strokeStyle = progress > 0.5 ? 'rgba(255,136,0,0.5)' : 'rgba(255,136,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Throat glow
    const glowGrad = ctx.createRadialGradient(midX, ay, 0, midX, ay, 12);
    glowGrad.addColorStop(0, `rgba(200,200,255,${0.3 + 0.2 * Math.sin(performance.now() * 0.003)})`);
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(midX - 15, ay - 15, 30, 30);

    // Points A and B
    ctx.fillStyle = '#4488ff';
    ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cccccc';
    ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();

    // Labels
    ctx.fillStyle = '#556688'; ctx.font = '7px "Space Grotesk"';
    ctx.textAlign = 'center'; ctx.fillText('A · 地球', ax, ay - 30); ctx.fillText('B · 月球', bx, by - 30);

    // Position indicator with trail
    const indicatorX = ax + (bx - ax) * progress;
    const indicatorY = ay; // on the center line
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath(); ctx.arc(indicatorX, indicatorY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(indicatorX, indicatorY, 6, 0, Math.PI * 2); ctx.stroke();

    // Label
    ctx.fillStyle = '#00f0ff'; ctx.font = '6px "JetBrains Mono"';
    ctx.fillText(`${(progress * 100).toFixed(0)}%`, indicatorX, indicatorY + 12);
  }

  // ════════════════════════════════════════════════════════════
  //  ARRIVAL SCENE (Moon)
  // ════════════════════════════════════════════════════════════
  function buildArrival(data = {}) {
    currentSceneInstance = createArrivalScene(canvas, perf);
    currentSceneInstance.flash(3.0);
    setTimeout(() => playArrivalChime(), 600);

    uiLayer.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));

    const container = document.createElement('div');
    container.className = 'arrival-container';

    const card = document.createElement('div');
    card.className = 'info-card wormhole-glass-heavy';

    const elapsed = data.elapsed ? formatTime(data.elapsed) : (data.skipped ? '量子跃迁' : '—');

    card.innerHTML = `
      <div class="info-card-header">
        <span class="material-symbols-outlined">dark_mode</span>
        <div>
          <div class="info-card-title">已抵达月球表面</div>
          <div class="info-card-subtitle">${data.skipped ? '量子跃迁完成 · Morris-Thorne 度规虫洞' : '虫洞穿越完成 · 时空曲率已恢复'}</div>
        </div>
      </div>
      <div class="data-grid">
        <div class="data-item"><div class="label">月球半径</div><div class="value">1,737 km</div></div>
        <div class="data-item"><div class="label">表面温度</div><div class="value">-173°C ~ +127°C</div></div>
        <div class="data-item"><div class="label">地月距离</div><div class="value">384,400 km</div></div>
        <div class="data-item"><div class="label">穿越用时</div><div class="value highlight">${elapsed}</div></div>
      </div>
      <p class="info-card-desc">虫洞奇点穿越成功。通过 Morris-Thorne 度规描述的拓扑结构，飞船在有限曲率的时空隧道中完成了从地球到月球的瞬时穿越。远处，地球如蓝色弹珠悬浮于黑暗太空。</p>
    `;

    const cardActions = document.createElement('div');
    cardActions.className = 'info-card-actions';

    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-cosmic btn-cosmic-secondary';
    shareBtn.innerHTML = '<span class="material-symbols-outlined">share</span> 分享星际坐标';
    shareBtn.setAttribute('aria-label', '分享月球坐标');
    shareBtn.addEventListener('click', () => {
      triggerHaptic('light');
      shareStellarCoordinates({
        planetName: '月球 (Moon)', similarity: '1.00 (母星卫星)', distance: '384,400',
        radius: '1,737 / 6,371', temperature: '-173°C ~ +127°C',
      });
    });
    cardActions.appendChild(shareBtn);

    const againBtn = document.createElement('button');
    againBtn.className = 'btn-cosmic btn-cosmic-primary';
    againBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> 再次穿越';
    againBtn.setAttribute('aria-label', '再次穿越虫洞');
    againBtn.addEventListener('click', () => { triggerHaptic('heavy'); transitionTo(SCENES.SPLASH); });
    cardActions.appendChild(againBtn);

    card.appendChild(cardActions);
    container.appendChild(card);
    uiLayer.appendChild(container);
  }

  // ── Init ──
  transitionTo(SCENES.SPLASH);

  return { getScene: () => currentSceneName, getPerf: () => perf, transitionTo, resize: onResize };
}
