// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  WORMHOLE APP v4.0 — Single Renderer + Unified Loop                 ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import { detectPerformance } from './utils/perf.js';
import { createSplashScene } from './scenes/splash.js';
import { createFlightScene } from './scenes/flight.js';
import { createArrivalScene } from './scenes/arrival.js';
import * as THREE from 'three';
import {
  audioInit, audioToggle, audioSetMuted,
  startWormholeHum, updateFlightAudio, stopAllAudio,
  playSingularityPass, playArrivalChime, playQuantumBoost, triggerHaptic
} from './audio.js';
import { shareStellarCoordinates } from './utils/share.js';

const S = { SPLASH: 'SPLASH', FLYING: 'FLYING', ARRIVAL: 'ARRIVAL' };
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0);
const fmtT = s => { const m = Math.floor(s / 60), sec = (s % 60).toFixed(1); return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };

export function createApp() {
  const canvas = document.getElementById('main-canvas');
  const uiLayer = document.getElementById('ui-layer');
  const ls = document.getElementById('loading-screen');
  const perf = detectPerformance();

  // ═══ SINGLE RENDERER ═══
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.tier !== 'low', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perf.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  let sceneName = null, sci = null, sc = null, cam = null;
  let rafId = null, lastFrame = 0;
  let redMotion = localStorage.getItem('wormhole-reduced-motion') === 'true';
  if (redMotion) document.body.classList.add('reduced-motion');
  setTimeout(() => ls.classList.add('hidden'), 400);

  // Resize
  function rs() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); if (cam) { cam.aspect = w / h; cam.updateProjectionMatrix(); } if (sci?.resize) sci.resize(w, h); }
  window.addEventListener('resize', rs);
  window.addEventListener('orientationchange', () => setTimeout(rs, 300));

  // Input
  let bpStart = 0, bpCheck = false, bpActive = false, bpHint = null;
  let flightStart = 0;
  function rbh() { if (bpHint) { bpHint.textContent = '长按屏幕加速'; bpHint.style.color = '#8899bb'; } }
  canvas.addEventListener('pointerdown', e => { if (sci?.onPointerDown) sci.onPointerDown(e); if (sceneName === S.FLYING) { bpStart = performance.now(); bpCheck = true; } });
  canvas.addEventListener('pointermove', e => { if (sci?.onPointerMove) sci.onPointerMove(e); });
  canvas.addEventListener('pointerup', () => { if (sci?.onPointerUp) sci.onPointerUp(); if (sceneName === S.FLYING) { bpCheck = false; if (bpActive) { sci.endBoost?.(); bpActive = false; rbh(); } } });
  canvas.addEventListener('pointerleave', () => { if (sci?.onPointerUp) sci.onPointerUp(); if (sceneName === S.FLYING) { bpCheck = false; if (bpActive) { sci.endBoost?.(); bpActive = false; rbh(); } } });
  canvas.addEventListener('wheel', e => { if (sci?.onWheel) sci.onWheel(e); });

  // ═══ TRANSITION ═══
  function go(target, data = {}) {
    uiLayer.innerHTML = ''; stopAllAudio(); bpActive = false; bpCheck = false; bpHint = null;
    if (sci?.dispose) sci.dispose();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    sceneName = target; renderer.toneMappingExposure = 1.2; renderer.clear(); lastFrame = performance.now();

    switch (target) {
      case S.SPLASH:
        sci = createSplashScene(perf); sc = sci.scene; cam = sci.camera; renderer.toneMappingExposure = 1.1;
        buildSplashUI();
        break;
      case S.FLYING:
        sci = createFlightScene(perf); sc = sci.scene; cam = sci.camera; sci.start(); flightStart = performance.now() * 0.001;
        try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
        buildFlightUI(data);
        break;
      case S.ARRIVAL:
        sci = createArrivalScene(perf); sc = sci.scene; cam = sci.camera; sci.flash(2.5);
        setTimeout(() => playArrivalChime(), 600);
        buildArrivalUI(data);
        break;
    }

    // START unified render loop
    lastFrame = performance.now();
    (function loop() {
      rafId = requestAnimationFrame(loop);
      const now = performance.now();
      let dt = Math.min((now - lastFrame) / 1000, 0.1); lastFrame = now;

      // ── Update current scene (once!) ──
      let out = null;
      if (sci?.update) out = sci.update(dt);

      // ── Flight-specific UI updates ──
      if (sceneName === S.FLYING && out) {
        const prog = out.progress, phys = out.phys;
        const speed = sci.getSpeed?.(), traveled = sci.getTraveled?.();
        updateFlightHUD(prog, phys, speed, traveled);
        updateFlightAudio(speed / 2, prog || 0);
        if (prog >= 1) {
          sci.startArrival(() => {
            stopAllAudio();
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            renderer.clear();
            go(S.ARRIVAL, { elapsed: performance.now() * 0.001 - flightStart });
          });
        }
      }

      // ── Arrival flash effect ──
      if (sci?.getFlashExposure) {
        const fe = sci.getFlashExposure();
        if (fe > 0) renderer.toneMappingExposure = 1.2 + fe;
      }

      renderer.render(sc, cam);
    })();
  }

  // ═══ SPLASH UI ═══
  function buildSplashUI() {
    const c = document.createElement('div'); c.className = 'splash-container';
    const t = document.createElement('h1'); t.className = 'splash-title';
    t.innerHTML = '触碰虫洞<span>地球 10km → 月球表面</span>'; c.appendChild(t);
    const n = document.createElement('p');
    n.style.cssText = 'color:#445577;font-size:0.55rem;letter-spacing:0.06em;text-align:center;margin-bottom:24px;';
    n.textContent = 'Morris-Thorne 度规 · 地月虫洞穿越'; c.appendChild(n);
    const a = document.createElement('div'); a.className = 'splash-actions';
    const b = document.createElement('button'); b.className = 'btn-cosmic btn-cosmic-primary';
    b.innerHTML = '<span class="material-symbols-outlined">rocket_launch</span> 启动穿越';
    b.addEventListener('click', () => { triggerHaptic('heavy'); audioInit(); audioSetMuted(true); sci.startTransition(() => go(S.FLYING)); });
    a.appendChild(b); c.appendChild(a); uiLayer.appendChild(c);
  }

  // ═══ FLIGHT UI ═══
  function buildFlightUI(data) {
    uiLayer.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));

    const tb = document.createElement('div'); tb.className = 'hud-top-bar';
    const mb = document.createElement('button'); mb.className = 'btn-icon';
    mb.innerHTML = '<span class="material-symbols-outlined">volume_off</span>';
    mb.addEventListener('click', () => { const m = audioToggle(); mb.innerHTML = m ? '<span class="material-symbols-outlined">volume_off</span>' : '<span class="material-symbols-outlined">volume_up</span>'; m ? stopAllAudio() : startWormholeHum(); triggerHaptic('light'); });
    tb.appendChild(mb);
    const se = document.createElement('div');
    se.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:0.55rem;color:#6699aa;letter-spacing:0.08em;';
    se.textContent = '1.0c'; se.id = 'speed-el'; tb.appendChild(se);
    const sk = document.createElement('button'); sk.className = 'btn-text'; sk.textContent = '跳过';
    sk.addEventListener('click', () => { stopAllAudio(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); go(S.ARRIVAL, { skipped: true }); });
    tb.appendChild(sk); uiLayer.appendChild(tb);

    const sch = document.createElement('div');
    sch.style.cssText = 'position:fixed;top:20px;right:12px;z-index:35;';
    const schC = document.createElement('canvas'); schC.width = 110; schC.height = 70; schC.id = 'sch-canvas';
    schC.style.cssText = 'width:110px;height:70px;border-radius:6px;background:rgba(2,4,8,0.7);border:1px solid rgba(255,255,255,0.08);';
    sch.appendChild(schC); uiLayer.appendChild(sch);

    const pg = document.createElement('div'); pg.className = 'progress-container';
    pg.innerHTML = '<div class="progress-label"><span id="pl">地球 10,000m</span><span id="pd">0 km</span></div><div class="progress-track"><div class="progress-fill" id="pf" style="width:0%"></div><div class="progress-marker" style="left:50%"></div></div>';
    uiLayer.appendChild(pg);

    bpHint = document.createElement('div');
    bpHint.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);color:#556677;font-size:0.55rem;letter-spacing:0.08em;z-index:30;';
    bpHint.textContent = '长按屏幕加速'; uiLayer.appendChild(bpHint);

    let hasTh = false;
    const pf = document.getElementById('pf'), pd = document.getElementById('pd'), pl = document.getElementById('pl'), speedEl = document.getElementById('speed-el');

    // Store flight UI updater on the scene instance
    sci._updateFlightHUD = function(prog, phys, speed, traveled) {
      speedEl.textContent = (speed / 1.6).toFixed(1) + 'c';
      pf.style.width = (prog * 100) + '%';
      if (pd) pd.textContent = fmt(traveled) + ' km';
      if (pl) pl.textContent = sci.physics?.getLocationInfo(prog)?.label || (prog * 100).toFixed(0) + '%';
      drawSch(document.getElementById('sch-canvas'), prog);

      if (bpCheck && !bpActive && (performance.now() - bpStart) > 400) {
        bpActive = true; sci.triggerBoost(); playQuantumBoost(); triggerHaptic('boost');
        bpHint.textContent = '加速中 ···'; bpHint.style.color = '#aaccee';
      }
      if (prog >= 0.48 && !hasTh) { hasTh = true; playSingularityPass(); triggerHaptic('heavy'); bpHint.textContent = '穿越喉部'; bpHint.style.color = '#ddaa66'; }
      if (prog >= 0.85 && !bpActive) { bpHint.textContent = '接近月球'; bpHint.style.color = '#cc9966'; }
    };
  }

  function updateFlightHUD(prog, phys, speed, traveled) {
    if (sci?._updateFlightHUD) sci._updateFlightHUD(prog, phys, speed, traveled);
  }

  function drawSch(c, prog) { if (!c) return; const ctx = c.getContext('2d'), w = c.width, h = c.height; ctx.clearRect(0, 0, w, h); ctx.fillStyle = 'rgba(2,4,10,0.85)'; ctx.fillRect(0, 0, w, h); const ax = 10, bx = w - 10, my = h / 2, mx = (ax + bx) / 2; ctx.strokeStyle = 'rgba(100,140,180,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, my - 12); ctx.quadraticCurveTo(mx, my - 4, bx, my - 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, my + 12); ctx.quadraticCurveTo(mx, my + 4, bx, my + 12); ctx.stroke(); ctx.fillStyle = '#446688'; ctx.beginPath(); ctx.arc(ax, my, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#998866'; ctx.beginPath(); ctx.arc(bx, my, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#556688'; ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.fillText('地', ax, my - 18); ctx.fillText('月', bx, my - 18); const ix = ax + (bx - ax) * prog; ctx.fillStyle = '#88aacc'; ctx.beginPath(); ctx.arc(ix, my, 2.5, 0, Math.PI * 2); ctx.fill(); }

  // ═══ ARRIVAL UI ═══
  function buildArrivalUI(data = {}) {
    const vig = document.createElement('div'); vig.className = 'vignette'; uiLayer.appendChild(vig);
    const c = document.createElement('div'); c.className = 'arrival-container';
    const card = document.createElement('div'); card.className = 'info-card wormhole-glass-heavy';
    const el = data.elapsed ? fmtT(data.elapsed) : (data.skipped ? '量子跃迁' : '—');
    card.innerHTML = `
      <div class="info-card-header"><span class="material-symbols-outlined">dark_mode</span>
      <div><div class="info-card-title">已抵达月球表面</div>
      <div class="info-card-subtitle">${data.skipped ? '量子跃迁完成' : '虫洞穿越完成'}</div></div></div>
      <div class="data-grid">
        <div class="data-item"><div class="label">月球半径</div><div class="value">1,737 km</div></div>
        <div class="data-item"><div class="label">表面温度</div><div class="value">-173°C ~ +127°C</div></div>
        <div class="data-item"><div class="label">地月距离</div><div class="value">384,400 km</div></div>
        <div class="data-item"><div class="label">穿越用时</div><div class="value highlight">${el}</div></div>
      </div>
      <p class="info-card-desc">虫洞穿越完成。地球 10km 高空 → 月球表面。Morris-Thorne 度规下的时空隧道。远处，地球如蓝色弹珠悬浮于月平线之上。</p>`;
    const act = document.createElement('div'); act.className = 'info-card-actions';
    const sb = document.createElement('button'); sb.className = 'btn-cosmic btn-cosmic-secondary';
    sb.innerHTML = '<span class="material-symbols-outlined">share</span> 分享坐标';
    sb.addEventListener('click', () => { triggerHaptic('light'); shareStellarCoordinates({ planetName: '月球', similarity: '1.00', distance: '384,400', radius: '1,737', temperature: '-173~+127°C' }); });
    act.appendChild(sb);
    const ab = document.createElement('button'); ab.className = 'btn-cosmic btn-cosmic-primary';
    ab.innerHTML = '<span class="material-symbols-outlined">replay</span> 再次穿越';
    ab.addEventListener('click', () => { triggerHaptic('heavy'); go(S.SPLASH); });
    act.appendChild(ab); card.appendChild(act); c.appendChild(card);
    uiLayer.appendChild(c);
  }

  // ═══ INIT ═══
  go(S.SPLASH);

  return { getScene: () => sceneName, getPerf: () => perf, go, resize: rs, renderer };
}
