/* Drifting sea-mist behind everything, on a full-bleed canvas.
   Pauses itself when the tab is hidden or motion is turned down. */

import { $ } from '../core/dom.js';
import { settings } from '../core/settings.js';

export function initMist() {
  const cv = $('mist');
  if (!cv) return;
  const cx = cv.getContext('2d');
  let W = 0, H = 0, raf = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.floor(innerWidth * dpr);
    H = cv.height = Math.floor(innerHeight * dpr);
  }
  resize();
  addEventListener('resize', resize);

  const blobs = Array.from({ length: 9 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.2 + Math.random() * 0.35,
    dx: (Math.random() - 0.5) * 0.0004,
    dy: (Math.random() - 0.5) * 0.0003,
    a: 0.04 + Math.random() * 0.07
  }));

  function draw(move) {
    cx.clearRect(0, 0, W, H);
    blobs.forEach(b => {
      if (move) { b.x = (b.x + b.dx + 1) % 1; b.y = (b.y + b.dy + 1) % 1; }
      const g = cx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * W);
      g.addColorStop(0, `rgba(190,150,80,${b.a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, W, H);
    });
  }

  function frame() {
    if (document.hidden) { raf = requestAnimationFrame(frame); return; }
    draw(settings.motion);
    raf = requestAnimationFrame(frame);
  }
  frame();
}
