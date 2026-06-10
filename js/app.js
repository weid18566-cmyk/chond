// App Orchestrator — Scene state machine, UI management, global event handling
import { detectPerformance } from './utils/perf.js';
import { createSplashScene } from './scenes/splash.js';
import { createFlightScene } from './scenes/flight.js';
import { createArrivalScene } from './scenes/arrival.js';
import {
  audioInit, audioToggle, audioSetMuted, audioIsMuted, audioOnChange,
  startWormholeHum, updateFlightAudio, stopAllAudio,
  playSingularityPass, playArrivalChime, playQuantumBoost, triggerHaptic
} from './audio.js';
import { shareStellarCoordinates } from './utils/share.js';

const SCENES = { SPLASH: 'SPLASH', FLYING: 'FLYING', ARRIVAL: 'ARRIVAL' };

export function createApp() {
  const canvas = document.getElementById('main-canvas');
  const uiLayer = document.getElementById('ui-layer');
  const loadingScreen = document.getElementById('loading-screen');

  const perf = detectPerformance();
  let currentSceneName = null;
  let currentSceneInstance = null;
  let animationId = null;
  let reducedMotion = false;

  if (localStorage.getItem('wormhole-reduced-motion') === 'true') {
    document.body.classList.add('reduced-motion');
    reducedMotion = true;
  }

  setTimeout(() => { loadingScreen.classList.add('hidden'); }, 600);

  // ── Resize ──
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (currentSceneInstance?.resize) currentSceneInstance.resize(w, h);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 300));

  // ── Centralized canvas input (delegates to current scene instance) ──
  let boostPressStart = 0;
  let boostCheckActive = false;
  let boostActive = false;
  let boostHintEl = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (currentSceneInstance?.onPointerDown) currentSceneInstance.onPointerDown(e);
    if (currentSceneName === SCENES.FLYING) {
      boostPressStart = performance.now();
      boostCheckActive = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (currentSceneInstance?.onPointerMove) currentSceneInstance.onPointerMove(e);
    if (currentSceneInstance?.addTrailPoint && currentSceneName === SCENES.SPLASH) {
      currentSceneInstance.addTrailPoint(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (currentSceneInstance?.onPointerUp) currentSceneInstance.onPointerUp();
    if (currentSceneName === SCENES.FLYING) {
      boostCheckActive = false;
      if (boostActive) { currentSceneInstance.endBoost?.(); boostActive = false; resetBoostHint(); }
    }
  });
  canvas.addEventListener('pointerleave', () => {
    if (currentSceneInstance?.onPointerUp) currentSceneInstance.onPointerUp();
    if (currentSceneName === SCENES.FLYING) {
      boostCheckActive = false;
      if (boostActive) { currentSceneInstance.endBoost?.(); boostActive = false; resetBoostHint(); }
    }
  });
  canvas.addEventListener('wheel', (e) => {
    if (currentSceneInstance?.onWheel) currentSceneInstance.onWheel(e);
  });

  function resetBoostHint() {
    if (boostHintEl) {
      boostHintEl.textContent = '长按屏幕 · 量子推进';
      boostHintEl.style.color = '#8899bb';
    }
  }

  // ── Scene transition ──
  function transitionTo(targetScene, data = {}) {
    uiLayer.innerHTML = '';
    if (currentSceneInstance?.dispose) currentSceneInstance.dispose();
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    stopAllAudio();
    boostActive = false;
    boostCheckActive = false;
    boostHintEl = null;
    currentSceneName = targetScene;

    switch (targetScene) {
      case SCENES.SPLASH: buildSplash(); break;
      case SCENES.FLYING: buildFlight(data); break;
      case SCENES.ARRIVAL: buildArrival(data); break;
    }
  }

  // ═══════════════════════════════════════════════
  //  SPLASH
  // ═══════════════════════════════════════════════
  function buildSplash() {
    currentSceneInstance = createSplashScene(canvas, perf);

    const container = document.createElement('div');
    container.className = 'splash-container';

    const title = document.createElement('h1');
    title.className = 'splash-title';
    title.innerHTML = '触碰虫洞，开启穿越<span>WORMHOLE SINGULARITY</span>';
    container.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'splash-actions';

    const launchBtn = document.createElement('button');
    launchBtn.className = 'btn-cosmic btn-cosmic-primary';
    launchBtn.innerHTML = '<span class="material-symbols-outlined">rocket_launch</span> 启动穿越';
    launchBtn.setAttribute('aria-label', '启动虫洞穿越');
    launchBtn.addEventListener('click', () => {
      triggerHaptic('heavy');
      audioInit();
      audioSetMuted(true);
      currentSceneInstance.startTransition(() => { transitionTo(SCENES.FLYING); });
    });
    actions.appendChild(launchBtn);

    const motionLabel = document.createElement('label');
    motionLabel.style.cssText = 'display:flex;align-items:center;gap:8px;color:#8899bb;font-size:0.7rem;cursor:pointer;letter-spacing:0.05em;';
    const motionCheck = document.createElement('input');
    motionCheck.type = 'checkbox';
    motionCheck.checked = reducedMotion;
    motionCheck.style.cssText = 'accent-color:#00f0ff;';
    motionCheck.addEventListener('change', () => {
      reducedMotion = motionCheck.checked;
      localStorage.setItem('wormhole-reduced-motion', reducedMotion ? 'true' : 'false');
      document.body.classList.toggle('reduced-motion', reducedMotion);
    });
    motionLabel.appendChild(motionCheck);
    motionLabel.appendChild(document.createTextNode('减少动态效果'));
    actions.appendChild(motionLabel);

    container.appendChild(actions);
    uiLayer.appendChild(container);
  }

  // ═══════════════════════════════════════════════
  //  FLIGHT
  // ═══════════════════════════════════════════════
  function buildFlight(data) {
    currentSceneInstance = createFlightScene(canvas, perf);
    currentSceneInstance.start();

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}

    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    uiLayer.appendChild(vignette);

    // Top bar HUD
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'btn-icon';
    muteBtn.setAttribute('aria-label', '切换音效');
    function updateMuteIcon(muted) {
      muteBtn.innerHTML = muted
        ? '<span class="material-symbols-outlined">volume_off</span>'
        : '<span class="material-symbols-outlined">volume_up</span>';
    }
    updateMuteIcon(true);
    muteBtn.addEventListener('click', () => {
      const muted = audioToggle();
      updateMuteIcon(muted);
      muted ? stopAllAudio() : startWormholeHum();
      triggerHaptic('light');
    });
    audioOnChange(updateMuteIcon);
    topBar.appendChild(muteBtn);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-text';
    skipBtn.textContent = '跳过穿越';
    skipBtn.setAttribute('aria-label', '跳过虫洞穿越，直接抵达');
    skipBtn.addEventListener('click', () => {
      triggerHaptic('light');
      stopAllAudio();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      transitionTo(SCENES.ARRIVAL, { skipped: true });
    });
    topBar.appendChild(skipBtn);
    uiLayer.appendChild(topBar);

    // Progress bar
    const progContainer = document.createElement('div');
    progContainer.className = 'progress-container';
    progContainer.innerHTML = `
      <div class="progress-label"><span>穿越里程</span><span id="prog-distance">0.0 ly</span></div>
      <div class="progress-track">
        <div class="progress-fill" id="prog-fill" style="width:0%"></div>
        <div class="progress-marker" style="left:85%"></div>
      </div>`;
    uiLayer.appendChild(progContainer);

    // Boost hint
    boostHintEl = document.createElement('div');
    boostHintEl.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);color:#8899bb;font-size:0.65rem;letter-spacing:0.08em;z-index:30;font-family:"Space Grotesk",sans-serif;';
    boostHintEl.textContent = '长按屏幕 · 量子推进';
    uiLayer.appendChild(boostHintEl);

    const progFill = document.getElementById('prog-fill');
    const distEl = document.getElementById('prog-distance');
    const totalDist = currentSceneInstance.getTotalDistance();
    let hasPassedSingularity = false;
    let lastTime = performance.now();

    function flightLoop() {
      const now = performance.now();
      let dt = (now - lastTime) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastTime = now;

      if (boostCheckActive && !boostActive && (now - boostPressStart) > 500) {
        boostActive = true;
        currentSceneInstance.triggerBoost();
        playQuantumBoost();
        triggerHaptic('boost');
        boostHintEl.textContent = '量子推进中 ···';
        boostHintEl.style.color = '#00f0ff';
      }

      const progress = currentSceneInstance.update(dt);
      const speed = currentSceneInstance.getSpeed();

      progFill.style.width = (progress * 100) + '%';
      if (distEl) distEl.textContent = ((progress * 1206)).toFixed(1) + ' ly';

      updateFlightAudio(speed / 2, progress);

      if (progress >= 0.85 && !hasPassedSingularity) {
        hasPassedSingularity = true;
        playSingularityPass();
        triggerHaptic('heavy');
        if (!boostActive) { boostHintEl.textContent = '接近奇点 ···'; }
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
    function handleKey(e) {
      if (currentSceneName !== SCENES.FLYING) return;
      if (e.key === 'ArrowRight') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 1.5);
      if (e.key === 'ArrowLeft') currentSceneInstance.setBaseSpeed(currentSceneInstance.getSpeed() * 0.7);
    }
    window.addEventListener('keydown', handleKey);
  }

  // ═══════════════════════════════════════════════
  //  ARRIVAL
  // ═══════════════════════════════════════════════
  function buildArrival(data = {}) {
    currentSceneInstance = createArrivalScene(canvas, perf);
    currentSceneInstance.flash(2.0);
    setTimeout(() => playArrivalChime(), 400);

    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    uiLayer.appendChild(vignette);

    const container = document.createElement('div');
    container.className = 'arrival-container';

    const card = document.createElement('div');
    card.className = 'info-card wormhole-glass-heavy';

    card.innerHTML = `
      <div class="info-card-header">
        <span class="material-symbols-outlined">globe</span>
        <div>
          <div class="info-card-title">已抵达 Kepler-442b</div>
          <div class="info-card-subtitle">${data.skipped ? '量子跃迁完成' : '虫洞穿越完成'}</div>
        </div>
      </div>
      <div class="data-grid">
        <div class="data-item"><div class="label">行星半径</div><div class="value">1.34 R⊕</div></div>
        <div class="data-item"><div class="label">表面温度</div><div class="value">-40°C ~ +10°C</div></div>
        <div class="data-item"><div class="label">轨道周期</div><div class="value">112.3 地球日</div></div>
        <div class="data-item"><div class="label">相似度指数</div><div class="value highlight">0.98</div></div>
      </div>
      <p class="info-card-desc">这颗超级地球位于宜居带内，表面可能存在液态水。大气光谱分析显示氮氧比例与地球高度相似，引力略强于母星。这里是人类星际文明的第二个家园候选。</p>
    `;

    const cardActions = document.createElement('div');
    cardActions.className = 'info-card-actions';

    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-cosmic btn-cosmic-secondary';
    shareBtn.innerHTML = '<span class="material-symbols-outlined">share</span> 分享星际坐标';
    shareBtn.setAttribute('aria-label', '分享星际坐标');
    shareBtn.addEventListener('click', () => {
      triggerHaptic('light');
      shareStellarCoordinates({
        planetName: 'Kepler-442b', similarity: '0.98', distance: '1206',
        radius: '1.34', temperature: '-40°C ~ +10°C',
      });
    });
    cardActions.appendChild(shareBtn);

    const againBtn = document.createElement('button');
    againBtn.className = 'btn-cosmic btn-cosmic-primary';
    againBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> 再次穿越';
    againBtn.setAttribute('aria-label', '再次进行虫洞穿越');
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
