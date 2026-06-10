// Performance detection & adaptive quality settings
export function detectPerformance() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  let tier = 'high';
  if (isMobile && cores <= 4 && memory <= 2) tier = 'low';
  else if (isMobile && cores <= 6 && memory <= 4) tier = 'medium';
  else if (!isMobile && cores <= 4) tier = 'medium';

  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 60;

  function measureFPS(now) {
    frameCount++;
    if (now - lastTime >= 1000) {
      fps = Math.round(frameCount / ((now - lastTime) / 1000));
      frameCount = 0;
      lastTime = now;
      if (fps < 30) tier = 'low';
      else if (fps < 50 && tier === 'high') tier = 'medium';
    }
    requestAnimationFrame(measureFPS);
  }
  requestAnimationFrame(measureFPS);

  return {
    tier,
    fps: () => fps,
    pixelRatio,
    isMobile,
    isLow: tier === 'low',
    isMedium: tier === 'medium',
    isHigh: tier === 'high',
    particleBudget: tier === 'high' ? 200000 : tier === 'medium' ? 80000 : 30000,
    starCount: tier === 'high' ? 3000 : tier === 'medium' ? 1500 : 600,
    gridDetail: tier === 'high' ? 200 : tier === 'medium' ? 120 : 60,
    bloomStrength: tier === 'high' ? 1.5 : tier === 'medium' ? 1.0 : 0.6,
    shadowMap: tier !== 'low',
    maxPixelRatio: tier === 'high' ? 2 : tier === 'medium' ? 1.5 : 1,
  };
}
