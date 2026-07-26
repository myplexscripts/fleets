/* Coins arcing from mid-screen into the reales counter on a payout. */

import { $ } from '../core/dom.js';
import { play } from './sound.js';
import { bump } from '../ui/hud.js';

export function coinFly(n) {
  const target = $('rReales');
  if (!target) return;
  const tgt = target.getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 12); i++) {
    const c = document.createElement('div');
    c.className = 'coin';
    const sx = innerWidth / 2 + (Math.random() - 0.5) * 140;
    const sy = innerHeight * 0.55 + (Math.random() - 0.5) * 80;
    c.style.left = sx + 'px';
    c.style.top = sy + 'px';
    document.body.appendChild(c);
    const dx = tgt.left + 8 - sx, dy = tgt.top + 8 - sy;
    c.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.4}px,${dy * 0.4 - 60}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0.9 }
    ], { duration: 650 + i * 60, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    setTimeout(() => {
      c.remove();
      if (i === 0) play('coin');
      bump('wReales');
    }, 650 + i * 60);
  }
}
