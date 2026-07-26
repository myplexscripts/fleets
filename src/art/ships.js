/* Procedural ship sprites.

   Every ship is drawn from SHIPCFG geometry as an SVG, then baked to a canvas
   so Phaser can use it as a texture. If img/ship_<type>_<palette>.png exists it
   wins — so real art can be dropped in per-combo without touching code. */

import { SHIPCFG, PALETTES, ART_COMBOS } from '../data/ships.js';

const IMG_PATHS = {};
ART_COMBOS.forEach(([t, p]) => { IMG_PATHS[t + '_' + p] = 'img/ship_' + t + '_' + p + '.png'; });

export const SHIP_URL = {};
export const SHIP_CANVAS = {};
export const SHIP_DIM = {};

export function svgShip(type, palette) {
  const c = SHIPCFG[type], W = c.L + 18, Ht = c.H + 30, hy = Ht - 16;
  const [sail, sail2, flag, hull] = PALETTES[palette];
  const trim = '#3d3020';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Ht}" width="${W * 3}" height="${Ht * 3}">`;

  c.masts.forEach(mx => {
    s += `<line x1="${mx}" y1="${hy}" x2="${mx}" y2="${hy - c.H}" stroke="${hull}" stroke-width="2"/>`;
    if (c.rig === 'sq') {
      const w1 = c.L * 0.30, w2 = c.L * 0.24, h1 = c.H * 0.34, h2 = c.H * 0.28;
      const y1 = hy - c.H * 0.42, y2 = hy - c.H * 0.82;
      s += `<path d="M${mx - w1 / 2},${y1} Q${mx},${y1 + 5} ${mx + w1 / 2},${y1} L${mx + w1 / 2},${y1 - h1} Q${mx},${y1 - h1 + 4} ${mx - w1 / 2},${y1 - h1} Z" fill="${sail}"/>`;
      s += `<path d="M${mx - w2 / 2},${y2} Q${mx},${y2 + 4} ${mx + w2 / 2},${y2} L${mx + w2 / 2},${y2 - h2} Q${mx},${y2 - h2 + 3} ${mx - w2 / 2},${y2 - h2} Z" fill="${sail2}"/>`;
    } else {
      s += `<path d="M${mx + 1},${hy - 4} L${mx + 1},${hy - c.H + 4} L${mx + c.L * 0.30},${hy - 8} Z" fill="${sail}"/>`;
      s += `<path d="M${mx - 1},${hy - c.H * 0.45} L${mx - 1},${hy - c.H + 2} L${mx - c.L * 0.20},${hy - c.H * 0.45} Z" fill="${sail2}"/>`;
    }
    s += `<path d="M${mx},${hy - c.H} l6,2 l-6,2 Z" fill="${flag}"/>`;
  });

  s += `<path d="M4,${hy - 6} L${W - 14},${hy - 6} L${W - 3},${hy - 13} L${W - 11},${hy + 4} Q${W / 2},${hy + 11} 12,${hy + 4} Z" fill="${hull}" stroke="${trim}" stroke-width="1"/>`;

  /* Gunports, count by class. */
  const n = type === 'manowar' ? 7 : (type === 'flagship' ? 6 : (type === 'frigate' ? 5 : (type === 'brig' ? 4 : 0)));
  for (let i = 0; i < n; i++) {
    s += `<rect x="${16 + i * (c.L - 26) / Math.max(1, n - 1)}" y="${hy - 3}" width="2.6" height="2.6" fill="${palette === 'flag' ? '#d9c98a' : '#4a3a22'}"/>`;
  }
  return s + '</svg>';
}

export function shipHTML(type, palette, scale, cls) {
  const key = type + '_' + palette, c = SHIPCFG[type], W = c.L + 18;
  const src = SHIP_URL[key] || ('data:image/svg+xml;utf8,' + encodeURIComponent(svgShip(type, palette)));
  return `<img class="shipsvg ${cls || ''}" style="width:${Math.round(W * (scale || 1))}px" alt="" src="${src}">`;
}

export function loadShipArt(onStep) {
  return Promise.all(ART_COMBOS.map(([type, pal]) => new Promise(res => {
    const key = type + '_' + pal, c = SHIPCFG[type], W = c.L + 18, H = c.H + 30;
    SHIP_DIM[key] = { w: W, h: H };

    const done = im => {
      const cv = document.createElement('canvas');
      cv.width = W * 3; cv.height = H * 3;
      cv.getContext('2d').drawImage(im, 0, 0, W * 3, H * 3);
      SHIP_CANVAS[key] = cv;
      if (onStep) onStep();
      res();
    };

    const user = new Image();
    user.onload = () => { SHIP_URL[key] = IMG_PATHS[key]; done(user); };
    user.onerror = () => {
      const im = new Image();
      im.onload = () => done(im);
      im.onerror = () => { if (onStep) onStep(); res(); };
      im.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgShip(type, pal));
    };
    user.src = IMG_PATHS[key];
  })));
}

export const artStepCount = ART_COMBOS.length;
