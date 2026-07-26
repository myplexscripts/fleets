/* The resource strip and its little count-up animations. */

import { $ } from '../core/dom.js';
import { S } from '../core/state.js';
import { busyIds, readyCount } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';

/* [state key, value element id, plate element id, label] */
const RES_DEFS = [
  ['reales',  'rReales',  'wReales',  'Reales'],
  ['cargo',   'rCargo',   'wCargo',   'Cargo'],
  ['parts',   'rParts',   'wParts',   'Parts'],
  ['barrels', 'rBarrels', 'wBarrels', 'Powder'],
  ['gems',    'rGems',    'wGems',    'Gems'],
  ['sea',     'rSea',     'wSea',     'At Sea']
];

const shown = {};

export function buildResStrip() {
  $('resStrip').innerHTML = RES_DEFS.map(([ic, vid, wid, lbl]) =>
    `<div class="resitem" id="${wid}" title="${lbl}">${iconHTML(ic, 0, 'resic')}<b id="${vid}">0</b><span>${lbl}</span></div>`
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
    reales: S.reales, cargo: S.cargo, parts: S.parts,
    barrels: S.barrels, gems: S.gems, sea: busyIds().size
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
