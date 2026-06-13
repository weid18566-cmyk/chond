// Entry point — Wormhole Singularity
import { createApp } from './app.js';

const app = createApp();

// Handle visibility change (pause/resume)
document.addEventListener('visibilitychange', () => {
  // Audio context may need to be resumed
});

// Prevent default touch behaviors that interfere
document.addEventListener('touchmove', (e) => {
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
  }
}, { passive: false });

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, false);

console.log('🌍🚀🌑 虫洞奇点·地月穿越 | Wormhole: Earth → Moon');
console.log('   穿越距离: 384,400 km');
console.log('   性能等级:', app.getPerf().tier);
console.log('   粒子预算:', app.getPerf().particleBudget.toLocaleString());
