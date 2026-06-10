// Web Audio API modular synthesizer for wormhole experience
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
    masterGain.connect(audioCtx.destination);
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
  const targetVol = isMuted ? 0 : 0.5;
  masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.1);
  listeners.forEach(fn => fn(isMuted));
  return isMuted;
}

export function audioSetMuted(muted) {
  if (!isInitialized || !audioCtx) return;
  isMuted = muted;
  const targetVol = isMuted ? 0 : 0.5;
  masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.1);
  listeners.forEach(fn => fn(isMuted));
}

export function audioIsMuted() {
  return isMuted;
}

export function audioOnChange(fn) {
  listeners.push(fn);
}

export function startWormholeHum() {
  if (!audioCtx || !masterGain) return;
  stopAllAudio();

  // Deep sub-bass drone
  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 28;
  const subGain = audioCtx.createGain();
  subGain.gain.value = 1.2;
  sub.connect(subGain);
  subGain.connect(masterGain);
  sub.start();
  oscillators.push({ osc: sub, gain: subGain });

  // Low rumble
  const rumble = audioCtx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 55;
  const rumbleGain = audioCtx.createGain();
  rumbleGain.gain.value = 0.15;
  const rumbleFilter = audioCtx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 200;
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(masterGain);
  rumble.start();
  oscillators.push({ osc: rumble, gain: rumbleGain, filter: rumbleFilter });

  // Mid texture (particle-like shimmer)
  initNoiseSource();
}

function initNoiseSource() {
  if (!audioCtx) return;
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1200;
  noiseFilter.Q.value = 0.5;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.08;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSource.start();
}

export function updateFlightAudio(speed, progress) {
  if (!audioCtx || !masterGain || isMuted) return;
  oscillators.forEach(({ osc, gain, filter }) => {
    if (osc.type === 'sine') {
      osc.frequency.linearRampToValueAtTime(28 + speed * 120, audioCtx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(1.2 + speed * 2, audioCtx.currentTime + 0.1);
    } else if (osc.type === 'sawtooth' && filter) {
      filter.frequency.linearRampToValueAtTime(200 + speed * 800, audioCtx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.15 + speed * 0.3, audioCtx.currentTime + 0.1);
    }
  });
  if (noiseSource) {
    masterGain.gain.linearRampToValueAtTime(
      isMuted ? 0 : 0.3 + speed * 0.4,
      audioCtx.currentTime + 0.1
    );
  }
}

export function playSingularityPass() {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 1.5);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.5);
}

export function playArrivalChime() {
  if (!audioCtx || isMuted) return;
  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, now + i * 0.15);
    gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.8);
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.8);
  });
  // Sub boom
  const boom = audioCtx.createOscillator();
  boom.type = 'sine';
  boom.frequency.value = 40;
  const boomGain = audioCtx.createGain();
  boomGain.gain.setValueAtTime(1.5, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
  boom.connect(boomGain);
  boomGain.connect(masterGain);
  boom.start();
  boom.stop(now + 2);
}

export function playQuantumBoost() {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 1);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 1);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + 1);
}

export function stopAllAudio() {
  oscillators.forEach(({ osc, gain }) => {
    try { osc.stop(); } catch (_) { /* already stopped */ }
  });
  oscillators = [];
  if (noiseSource) {
    try { noiseSource.stop(); } catch (_) { /* */ }
    noiseSource = null;
  }
}

export function triggerHaptic(type = 'light') {
  try {
    if (navigator.vibrate) {
      if (type === 'heavy') navigator.vibrate([30, 50, 30]);
      else if (type === 'boost') navigator.vibrate([15, 30, 15, 30, 15]);
      else navigator.vibrate(10);
    }
  } catch (_) { /* not supported */ }
}
