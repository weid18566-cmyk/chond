// Share functionality & canvas poster generation
export async function shareStellarCoordinates(data) {
  const shareData = {
    title: '虫洞奇点·星际穿越',
    text: `已抵达 ${data.planetName}\n相似度指数: ${data.similarity}\n距地球: ${data.distance} 光年\n#虫洞奇点 #星际穿越`,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (_) { /* user cancelled or error */ }
  }
  await generateSharePoster(data);
}

export async function generateSharePoster(data) {
  const canvas = document.createElement('canvas');
  const dpr = 2;
  const w = 750, h = 1334;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Deep space background gradient
  const bgGrad = ctx.createRadialGradient(w / 2, h * 0.3, 50, w / 2, h / 2, w);
  bgGrad.addColorStop(0, '#0a1628');
  bgGrad.addColorStop(0.5, '#06080d');
  bgGrad.addColorStop(1, '#020408');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.5;
    const alpha = Math.random() * 0.8 + 0.2;
    ctx.fillStyle = `rgba(224, 232, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nebula glow
  const nebulaGrad = ctx.createRadialGradient(w * 0.6, h * 0.35, 0, w * 0.6, h * 0.35, 350);
  nebulaGrad.addColorStop(0, 'rgba(123, 47, 247, 0.3)');
  nebulaGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.08)');
  nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, w, h);

  // Planet (procedural circle)
  const px = w * 0.55, py = h * 0.4, pr = 130;
  const planetGrad = ctx.createRadialGradient(px - 30, py - 30, pr * 0.1, px, py, pr);
  planetGrad.addColorStop(0, '#4a8faa');
  planetGrad.addColorStop(0.4, '#1e5070');
  planetGrad.addColorStop(0.8, '#0a2a40');
  planetGrad.addColorStop(1, '#051520');
  ctx.fillStyle = planetGrad;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();

  // Atmosphere glow
  const atmoGrad = ctx.createRadialGradient(px, py, pr * 0.85, px, py, pr * 1.3);
  atmoGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
  atmoGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.15)');
  atmoGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = atmoGrad;
  ctx.beginPath();
  ctx.arc(px, py, pr * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Surface bands
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 8; i++) {
    const y = py - pr + (i + 1) * (pr * 2 / 9);
    ctx.fillStyle = `rgba(0, 240, 255, ${0.03 + Math.random() * 0.04})`;
    ctx.fillRect(px - pr, y - pr * 0.08, pr * 2, pr * 0.16);
  }
  ctx.restore();

  // Title
  ctx.fillStyle = '#e0e8ff';
  ctx.font = '700 42px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('虫洞奇点·星际穿越', w / 2, h * 0.75);

  // Subtitle
  ctx.fillStyle = '#00f0ff';
  ctx.font = '500 22px "Space Grotesk", sans-serif';
  ctx.fillText(data.planetName || 'Kepler-442b', w / 2, h * 0.75 + 50);

  // Data row
  const dataY = h * 0.82;
  ctx.fillStyle = '#8899bb';
  ctx.font = '400 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const dataText = [
    `相似度   ${data.similarity || '0.98'}`,
    `距离     ${data.distance || '1206'} 光年`,
    `半径     ${data.radius || '1.34'} R⊕`,
    `表面温度  ${data.temperature || '-40°C'}`
  ];
  dataText.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const dx = col === 0 ? w * 0.35 : w * 0.65;
    ctx.textAlign = col === 0 ? 'right' : 'left';
    ctx.fillText(t, dx, dataY + row * 30);
  });

  // Footer
  ctx.fillStyle = 'rgba(136, 153, 187, 0.6)';
  ctx.font = '300 14px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('穿越用时 0.87s  |  虫洞引擎 v2.4', w / 2, h * 0.92);

  // Timestamp
  const now = new Date();
  ctx.fillText(
    `穿越时间  ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    w / 2, h * 0.92 + 24
  );

  // Bottom border glow
  const borderGrad = ctx.createLinearGradient(0, h - 4, w, h - 4);
  borderGrad.addColorStop(0, 'rgba(0,240,255,0)');
  borderGrad.addColorStop(0.3, '#00f0ff');
  borderGrad.addColorStop(0.5, '#7b2ff7');
  borderGrad.addColorStop(0.7, '#ff00aa');
  borderGrad.addColorStop(1, 'rgba(255,0,170,0)');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, h - 4, w, 4);

  // Show modal
  showShareModal(canvas);
  return canvas;
}

function showShareModal(sourceCanvas) {
  const existing = document.querySelector('.share-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'share-overlay';

  const card = document.createElement('div');
  card.className = 'share-card';

  const imgCanvas = document.createElement('canvas');
  const maxW = 360;
  const scale = maxW / sourceCanvas.width;
  imgCanvas.width = maxW;
  imgCanvas.height = sourceCanvas.height * scale;
  const ictx = imgCanvas.getContext('2d');
  ictx.drawImage(sourceCanvas, 0, 0, imgCanvas.width, imgCanvas.height);
  card.appendChild(imgCanvas);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-icon share-card-close';
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  closeBtn.setAttribute('aria-label', '关闭分享卡片');
  card.appendChild(closeBtn);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Click to close
  const close = () => { overlay.remove(); };
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  overlay.addEventListener('click', close);

  // Long press hint
  const hint = document.createElement('p');
  hint.style.cssText = 'color:#8899bb;font-size:12px;text-align:center;margin-top:12px;letter-spacing:0.05em;';
  hint.textContent = '长按图片保存';
  overlay.appendChild(hint);
}
