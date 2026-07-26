/* The resource strip and its little count-up animations.

   Five plates fit comfortably on a phone; goods and materials show as totals and
   open the Ship's Stores sheet when tapped. */

import { $ } from '../core/dom.js';
import { S } from '../core/state.js';
import { busyIds, readyCount, totalGoods, totalMats } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';

/* [key, value element id, plate element id, label, opens stores?] */
const RES_DEFS = [
  ['gold',    'rGold',    'wGold',    'Gold',   false],
  ['cargo',   'rGoods',   'wGoods',   'Goods',  true],
  ['mats',    'rMats',    'wMats',    'Materials', true],
  ['barrels', 'rBarrels', 'wBarrels', 'Powder', false],
  ['sea',     'rSea',     'wSea',     'At Sea', false]
];

const shown = {};

export function buildResStrip() {
  $('resStrip').innerHTML = RES_DEFS.map(([ic, vid, wid, lbl, opens]) =>
    `<div class="resitem${opens ? ' tappable' : ''}" id="${wid}" title="${lbl}"
       ${opens ? 'data-act="stores"' : ''}>${iconHTML(ic, 0, 'resic')}<b id="${vid}">0</b><span${lbl.length > 7 ? ' class="tight"' : ''}>${lbl}</span></div>`
  ).join('');
}

export function bump(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 180);
}

export function updateRes() {
  if (!S) return;
  const vals = {
    gold: S.gold, cargo: totalGoods(), mats: totalMats(),
    barrels: S.barrels, sea: busyIds().size
  };
  RES_DEFS.forEach(([key, vid, wid]) => {
    const el = $(vid);
    if (!el) return;
    const to = vals[key], from = shown[key] ?? to;
    shown[key] = to;
    if (from === to) { el.textContent = to; return; }
    bump(wid);
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / 450);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });

  const b = $('voyBadge');
  if (b) {
    const n = S.voyages.length, rdy = readyCount();
    if (n) { b.style.display = ''; b.textContent = rdy || n; b.className = 'badge' + (rdy ? ' rdy' : ''); }
    else b.style.display = 'none';
  }
}
