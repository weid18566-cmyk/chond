// App Orchestrator — Scene state machine, physics-driven HUD, 2D wormhole overlay
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

  // ═══════════  SPLASH  ═══════════
  function buildSplash() {
    currentSceneInstance = createSplashScene(canvas, perf);

    const container = document.createElement('div');
    container.className = 'splash-container';

    const title = document.createElement('h1');
    title.className = 'splash-title';
    title.innerHTML = '触碰虫洞，开启穿越<span>地球 → 月球 // WORMHOLE</span>';
    container.appendChild(title);

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

  // ═══════════  FLIGHT  ═══════════
  function buildFlight(data) {
    currentSceneInstance = createFlightScene(canvas, perf);
    currentSceneInstance.start();

    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}

    // Vignette
    uiLayer.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));

    // ── 2D Wormhole Schematic (top-right) ──
    const schematic = document.createElement('div');
    schematic.id = 'wormhole-schematic';
    schematic.style.cssText = 'position:fixed;top:calc(20px + env(safe-area-inset-top,0));right:16px;width:120px;height:80px;z-index:35;';
    const schCanvas = document.createElement('canvas');
    schCanvas.width = 120; schCanvas.height = 80;
    schCanvas.style.cssText = 'width:120px;height:80px;border-radius:8px;background:rgba(6,8,13,0.5);border:1px solid rgba(0,240,255,0.15);';
    schematic.appendChild(schCanvas);
    const schLabel = document.createElement('div');
    schLabel.style.cssText = 'color:#8899bb;font-size:0.5rem;text-align:center;letter-spacing:0.05em;margin-top:4px;';
    schLabel.textContent = '虫洞二维剖面';
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

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-text'; skipBtn.textContent = '跳过穿越';
    skipBtn.setAttribute('aria-label', '跳过虫洞穿越');
    skipBtn.addEventListener('click', () => { triggerHaptic('light'); stopAllAudio(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); transitionTo(SCENES.ARRIVAL, { skipped: true }); });
    topBar.appendChild(skipBtn);
    uiLayer.appendChild(topBar);

    // ── Physics Data HUD (left side) ──
    const physHUD = document.createElement('div');
    physHUD.id = 'physics-hud';
    physHUD.style.cssText = 'position:fixed;left:16px;top:30%;z-index:35;font-family:"JetBrains Mono",monospace;font-size:0.55rem;color:#8899bb;pointer-events:none;';
    uiLayer.appendChild(physHUD);

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
    boostHintEl.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);color:#8899bb;font-size:0.65rem;letter-spacing:0.08em;z-index:30;font-family:"Space Grotesk",sans-serif;';
    boostHintEl.textContent = '长按屏幕 · 量子推进';
    uiLayer.appendChild(boostHintEl);

    const progFill = document.getElementById('prog-fill');
    const distEl = document.getElementById('prog-distance');
    const locLabel = document.getElementById('prog-loc-label');
    const physHud = document.getElementById('physics-hud');
    let hasPassedThroat = false;
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

      // Progress bar
      progFill.style.width = (progress * 100) + '%';
      if (distEl) distEl.textContent = formatNumber(traveled) + ' km';
      if (locLabel) {
        const loc = currentSceneInstance.physics.getLocationInfo(progress);
        locLabel.textContent = loc.label;
      }

      // Physics HUD data
      if (physHud) {
        physHud.innerHTML = `
          时间膨胀  ${(1 / Math.sqrt(1 - speed * 0.01)).toFixed(3)}τ<br>
          潮汐力    ${(phys.tidal * 100).toFixed(1)} N/kg<br>
          蓝移/红移 ${phys.doppler > 0 ? '+' : ''}${(phys.doppler * 100).toFixed(1)}%<br>
          喉部半径  ${phys.radius.toFixed(2)} r₀
        `;
      }

      // 2D Schematic update
      drawSchematic(schCanvas, progress);

      updateFlightAudio(speed / 2, progress);

      // Throat passage event
      if (progress >= 0.45 && !hasPassedThroat) {
        hasPassedThroat = true;
        playSingularityPass(); triggerHaptic('heavy');
        if (!boostActive) { boostHintEl.textContent = '穿越喉部 ···'; boostHintEl.style.color = '#ffaa00'; }
      }

      // Exit approach
      if (progress >= 0.90) {
        if (!boostActive) { boostHintEl.textContent = '即将抵达月球 ···'; boostHintEl.style.color = '#ff8800'; }
      }

      if (progress >= 1) {
        currentSceneInstance.startArrival(() => {
          stopAllAudio();
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          transitionTo(SCENES.ARRIVAL);
        });
      }

      animationId = requestAnimationFrame(flightLoop);
    }
    animationId = requestAnimationFrame(flightLoop);

    // Keyboard shortcuts
    window.addEventListener('keydown', function hk(e) {
      if (currentSceneName !== SCENES.FLYING) return;
      if (e.key === 'ArrowRight') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 1.5);
      if (e.key === 'ArrowLeft') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 0.7);
    });
  }

  // ── 2D Wormhole Schematic Drawing ──
  function drawSchematic(canvas, progress) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(6,8,13,0.85)';
    ctx.fillRect(0, 0, w, h);

    // Points A and B
    const ax = 8, ay = h / 2;       // Earth side
    const bx = w - 8, by = h / 2;   // Moon side

    // Draw points
    ctx.fillStyle = '#4488ff'; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cccccc'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();

    // Labels
    ctx.fillStyle = '#8899bb'; ctx.font = '7px "Space Grotesk"';
    ctx.textAlign = 'center'; ctx.fillText('地球', ax, ay - 8);
    ctx.fillText('月球', bx, by - 8);

    // Wormhole tunnel curve (hourglass shape)
    const midX = (ax + bx) / 2;
    const cx1 = ax + (midX - ax) * 0.4;
    const cx2 = midX + (bx - midX) * 0.6;
    const throatWidth = 3;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(cx1, ay - 18, cx1, ay - 18, midX, ay - throatWidth);
    ctx.strokeStyle = 'rgba(0,240,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(cx1, ay + 18, cx1, ay + 18, midX, ay + throatWidth);
    ctx.strokeStyle = 'rgba(0,240,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, ay - throatWidth);
    ctx.bezierCurveTo(cx2, ay - 18, cx2, ay - 18, bx, by);
    ctx.strokeStyle = 'rgba(255,136,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, ay + throatWidth);
    ctx.bezierCurveTo(cx2, ay + 18, cx2, ay + 18, bx, by);
    ctx.strokeStyle = 'rgba(255,136,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Throat glow
    const glowGrad = ctx.createRadialGradient(midX, ay, 0, midX, ay, 8);
    glowGrad.addColorStop(0, 'rgba(200,200,255,0.5)'); glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad; ctx.fillRect(midX - 10, ay - 10, 20, 20);

    // Current position indicator
    const indicatorX = ax + (bx - ax) * progress;
    ctx.fillStyle = '#00f0ff'; ctx.beginPath(); ctx.arc(indicatorX, ay, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ═══════════  ARRIVAL (MOON)  ═══════════
  function buildArrival(data = {}) {
    currentSceneInstance = createArrivalScene(canvas, perf);
    currentSceneInstance.flash(2.5);
    setTimeout(() => playArrivalChime(), 500);

    uiLayer.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));

    const container = document.createElement('div');
    container.className = 'arrival-container';

    const card = document.createElement('div');
    card.className = 'info-card wormhole-glass-heavy';

    card.innerHTML = `
      <div class="info-card-header">
        <span class="material-symbols-outlined">dark_mode</span>
        <div>
          <div class="info-card-title">已抵达月球表面</div>
          <div class="info-card-subtitle">${data.skipped ? '量子跃迁完成 · 地月虫洞' : '虫洞穿越完成 · 事件视界已越过'}</div>
        </div>
      </div>
      <div class="data-grid">
        <div class="data-item"><div class="label">月球半径</div><div class="value">1,737 km</div></div>
        <div class="data-item"><div class="label">表面温度</div><div class="value">-173°C ~ +127°C</div></div>
        <div class="data-item"><div class="label">地月距离</div><div class="value">384,400 km</div></div>
        <div class="data-item"><div class="label">虫洞穿越用时</div><div class="value highlight">${data.skipped ? '量子跃迁' : (performance.now() * 0.001).toFixed(1) + 's'}</div></div>
      </div>
      <p class="info-card-desc">虫洞奇点穿越成功。月球表面呈现在眼前——灰色的月海与高地的撞击坑在阳光下分明可见。远处，地球如蓝色弹珠悬浮于黑暗太空。人类终于掌握了时空折叠的技术。</p>
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
