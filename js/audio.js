// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  INTERSTELLAR AUDIO ENGINE v2.0                                      ║
// ║  Web Audio API modular synthesizer inspired by Hans Zimmer's         ║
// ║  Interstellar soundtrack: deep organ drones, tension strings,       ║
// ║  cosmic ambience, and dramatic event effects                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝
let audioCtx = null;
let masterGain = null;
let isMuted = true;
let isInitialized = false;
let oscillators = [];
let noiseSource = null;
let listeners = [];

export function audioInit() {
  if (isInitialized) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    // Master compressor for smoother dynamics
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
    isInitialized = true;
  } catch (_) {
    console.warn('Web Audio API not available');
  }
}

export function audioToggle() {
  if (!isInitialized) audioInit();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isMuted = !isMuted;
  const targetVol = isMuted ? 0 : 0.45;
  masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.15);
  listeners.forEach(fn => fn(isMuted));
  return isMuted;
}

export function audioSetMuted(muted) {
  if (!isInitialized || !audioCtx) return;
  isMuted = muted;
  const targetVol = isMuted ? 0 : 0.45;
  masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.15);
  listeners.forEach(fn => fn(isMuted));
}

export function audioIsMuted() { return isMuted; }
export function audioOnChange(fn) { listeners.push(fn); }

// ══════════════════════════════════════════════════════════════
//  WORMHOLE HUM — Main flight ambience
// ══════════════════════════════════════════════════════════════
export function startWormholeHum() {
  if (!audioCtx || !masterGain) return;
  stopAllAudio();

  // ── Layer 1: Deep sub-bass drone (Interstellar organ pedal) ──
  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 22; // Very low — felt more than heard
  const subGain = audioCtx.createGain();
  subGain.gain.value = 1.2;
  const subFilter = audioCtx.createBiquadFilter();
  subFilter.type = 'lowpass';
  subFilter.frequency.value = 80;
  sub.connect(subFilter);
  subFilter.connect(subGain);
  subGain.connect(masterGain);
  sub.start();
  oscillators.push({ osc: sub, gain: subGain, filter: subFilter });

  // ── Layer 2: Organ fundamental (pipe organ feel) ──
  const organ = audioCtx.createOscillator();
  organ.type = 'sine';
  organ.frequency.value = 55; // A1
  const organGain = audioCtx.createGain();
  organGain.gain.value = 0.3;
  organ.connect(organGain);
  organGain.connect(masterGain);
  organ.start();
  oscillators.push({ osc: organ, gain: organGain, name: 'organ' });

  // ── Layer 3: Fifth harmonic (adds harmonic richness) ──
  const fifth = audioCtx.createOscillator();
  fifth.type = 'sine';
  fifth.frequency.value = 82.5; // E2 (perfect fifth above)
  const fifthGain = audioCtx.createGain();
  fifthGain.gain.value = 0.12;
  fifth.connect(fifthGain);
  fifthGain.connect(masterGain);
  fifth.start();
  oscillators.push({ osc: fifth, gain: fifthGain, name: 'fifth' });

  // ── Layer 4: Tension layer (sawtooth — builds cinematic tension) ──
  const tension = audioCtx.createOscillator();
  tension.type = 'sawtooth';
  tension.frequency.value = 65;
  const tensionGain = audioCtx.createGain();
  tensionGain.gain.value = 0.02;
  const tensionFilter = audioCtx.createBiquadFilter();
  tensionFilter.type = 'lowpass';
  tensionFilter.frequency.value = 200;
  tensionFilter.Q.value = 2;
  tension.connect(tensionFilter);
  tensionFilter.connect(tensionGain);
  tensionGain.connect(masterGain);
  tension.start();
  oscillators.push({ osc: tension, gain: tensionGain, filter: tensionFilter, name: 'tension' });

  // ── Layer 5: High string shimmer (Zimmer-style sustained strings) ──
  const shimmer = audioCtx.createOscillator();
  shimmer.type = 'triangle';
  shimmer.frequency.value = 220;
  const shimmerGain = audioCtx.createGain();
  shimmerGain.gain.value = 0.008;
  const shimmerFilter = audioCtx.createBiquadFilter();
  shimmerFilter.type = 'lowpass';
  shimmerFilter.frequency.value = 400;
  shimmer.connect(shimmerFilter);
  shimmerFilter.connect(shimmerGain);
  shimmerGain.connect(masterGain);
  shimmer.start();
  oscillators.push({ osc: shimmer, gain: shimmerGain, filter: shimmerFilter, name: 'shimmer' });

  // ── Layer 6: Noise / cosmic ambience ──
  initNoiseSource();
}

function initNoiseSource() {
  if (!audioCtx) return;
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }
  }
  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 800;
  noiseFilter.Q.value = 0.4;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.06;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSource.start();
}

// ══════════════════════════════════════════════════════════════
//  FLIGHT AUDIO UPDATE — Dynamic modulation during traversal
// ══════════════════════════════════════════════════════════════
export function updateFlightAudio(speed, progress) {
  if (!audioCtx || !masterGain || isMuted) return;

  oscillators.forEach(({ osc, gain, filter, name }) => {
    if (osc.type === 'sine' && !name) {
      // Sub drone: rises with speed, intensity increases near throat
      const throatProximity = 1 - Math.min(1, Math.abs(progress - 0.5) * 3);
      const targetFreq = 22 + speed * 120 + throatProximity * 30;
      osc.frequency.linearRampToValueAtTime(targetFreq, audioCtx.currentTime + 0.15);
      gain.gain.linearRampToValueAtTime(1.2 + speed * 2 + throatProximity * 1.5, audioCtx.currentTime + 0.15);
    } else if (name === 'organ') {
      // Organ: gentle swell with progress
      const throatProximity = 1 - Math.min(1, Math.abs(progress - 0.5) * 3);
      osc.frequency.linearRampToValueAtTime(55 + throatProximity * 15, audioCtx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.3 + throatProximity * 0.2, audioCtx.currentTime + 0.1);
    } else if (name === 'fifth') {
      gain.gain.linearRampToValueAtTime(0.12 + speed * 0.15, audioCtx.currentTime + 0.1);
    } else if (name === 'tension' && filter) {
      // Tension builds approaching throat, releases after
      const throatDist = Math.abs(progress - 0.5);
      const tensionVol = 0.02 + (1 - throatDist * 2.5) * 0.18;
      gain.gain.linearRampToValueAtTime(Math.max(0.01, Math.min(0.2, tensionVol)), audioCtx.currentTime + 0.15);
      filter.frequency.linearRampToValueAtTime(200 + speed * 500 + (1 - throatDist * 2) * 400, audioCtx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(65 + speed * 180, audioCtx.currentTime + 0.15);
    } else if (name === 'shimmer' && filter) {
      // String shimmer: more prominent near throat
      const throatProximity = 1 - Math.min(1, Math.abs(progress - 0.5) * 3);
      gain.gain.linearRampToValueAtTime(0.008 + throatProximity * 0.025, audioCtx.currentTime + 0.1);
      filter.frequency.linearRampToValueAtTime(400 + throatProximity * 600, audioCtx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(220 + throatProximity * 110, audioCtx.currentTime + 0.1);
    }
  });

  // Master volume modulation
  if (noiseSource && masterGain && !isMuted) {
    const throatProximity = 1 - Math.min(1, Math.abs(progress - 0.5) * 3);
    masterGain.gain.linearRampToValueAtTime(
      Math.min(0.6, 0.2 + speed * 0.4 + throatProximity * 0.15),
      audioCtx.currentTime + 0.15
    );
  }
}

// ══════════════════════════════════════════════════════════════
//  EVENT SOUNDS
// ══════════════════════════════════════════════════════════════

// ── Singularity Pass — Dramatic frequency sweep (Interstellar crescendo) ──
export function playSingularityPass() {
  if (!audioCtx || isMuted) return;
  const now = audioCtx.currentTime;

  // Main sweep (deep to high)
  const sweep = audioCtx.createOscillator();
  sweep.type = 'sine';
  sweep.frequency.setValueAtTime(80, now);
  sweep.frequency.exponentialRampToValueAtTime(2000, now + 2.0);
  sweep.frequency.exponentialRampToValueAtTime(300, now + 3.0);
  const sweepGain = audioCtx.createGain();
  sweepGain.gain.setValueAtTime(0.5, now);
  sweepGain.gain.linearRampToValueAtTime(0.7, now + 0.8);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
  sweep.connect(sweepGain);
  sweepGain.connect(masterGain);
  sweep.start(now);
  sweep.stop(now + 3.0);

  // Harmonic layer (adds richness)
  const harmonic = audioCtx.createOscillator();
  harmonic.type = 'triangle';
  harmonic.frequency.setValueAtTime(160, now);
  harmonic.frequency.exponentialRampToValueAtTime(1500, now + 1.5);
  const harmGain = audioCtx.createGain();
  harmGain.gain.setValueAtTime(0.2, now);
  harmGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
  harmonic.connect(harmGain);
  harmGain.connect(masterGain);
  harmonic.start(now);
  harmonic.stop(now + 2.5);

  // Noise burst at climax
  const burst = audioCtx.createOscillator();
  burst.type = 'sawtooth';
  burst.frequency.setValueAtTime(100, now + 0.5);
  burst.frequency.exponentialRampToValueAtTime(800, now + 1.5);
  const burstFilter = audioCtx.createBiquadFilter();
  burstFilter.type = 'bandpass';
  burstFilter.frequency.setValueAtTime(500, now + 0.5);
  burstFilter.frequency.exponentialRampToValueAtTime(2000, now + 1.5);
  burstFilter.Q.value = 5;
  const burstGain = audioCtx.createGain();
  burstGain.gain.setValueAtTime(0, now);
  burstGain.gain.linearRampToValueAtTime(0.15, now + 0.7);
  burstGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  burstGain.connect(masterGain);
  burst.start(now + 0.5);
  burst.stop(now + 2.0);
}

// ── Arrival Chime — Ethereal arpeggio (Zimmer-style) ──
export function playArrivalChime() {
  if (!audioCtx || isMuted) return;
  const now = audioCtx.currentTime;
  // C major 7th arpeggio with spacings
  const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = i < 3 ? 'sine' : 'triangle';
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.2);
    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.2 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 1.2);
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + i * 0.2);
    osc.stop(now + i * 0.2 + 1.2);
  });
  // Sub boom (earthquake rumble)
  const boom = audioCtx.createOscillator();
  boom.type = 'sine';
  boom.frequency.value = 30;
  const boomGain = audioCtx.createGain();
  boomGain.gain.setValueAtTime(1.8, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
  boom.connect(boomGain);
  boomGain.connect(masterGain);
  boom.start(now);
  boom.stop(now + 2.5);
}

// ── Quantum Boost — Intense acceleration sound ──
export function playQuantumBoost() {
  if (!audioCtx || isMuted) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.5);
  osc.frequency.exponentialRampToValueAtTime(200, now + 1.5);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(4000, now + 0.4);
  filter.frequency.exponentialRampToValueAtTime(500, now + 1.5);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 1.5);

  // Sub hit
  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(50, now);
  sub.frequency.exponentialRampToValueAtTime(25, now + 0.8);
  const subGain = audioCtx.createGain();
  subGain.gain.setValueAtTime(0.8, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  sub.connect(subGain);
  subGain.connect(masterGain);
  sub.start(now);
  sub.stop(now + 0.8);
}

export function stopAllAudio() {
  oscillators.forEach(({ osc, gain }) => {
    try { osc.stop(); } catch (_) { }
  });
  oscillators = [];
  if (noiseSource) {
    try { noiseSource.stop(); } catch (_) { }
    noiseSource = null;
  }
}

export function triggerHaptic(type = 'light') {
  try {
    if (navigator.vibrate) {
      if (type === 'heavy') navigator.vibrate([40, 60, 40]);
      else if (type === 'boost') navigator.vibrate([20, 40, 20, 40, 20]);
      else navigator.vibrate(10);
    }
  } catch (_) { }
}
