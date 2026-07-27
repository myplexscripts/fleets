/* The purse.

   One number and one door. Gold is the only figure worth carrying on every
   screen — everything else the player owns has a screen of its own that says it
   better, and five plates of running totals above a map is a spreadsheet
   header, not a game. The second plate opens the Ship's Stores and carries no
   number at all: it is a way in, not a readout.

   It shows on Port and Market, where money is the thing you are thinking about,
   and nowhere else. */

import { $ } from '../core/dom.js';
import { S } from '../core/state.js';
import { readyCount } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';

/* Screens where money is part of the decision in front of you. */
const PURSE_TABS = ['fleet', 'port'];

let shownGold = null;

export function buildResStrip() {
  $('resStrip').innerHTML =
    `<div class="resitem" id="wGold" title="Gold">
       ${iconHTML('gold', 0, 'resic')}<b id="rGold">0</b><span>Gold</span>
     </div>
     <div class="resitem tappable" id="wStores" title="Ship's Stores" data-act="stores">
       ${iconHTML('cargo', 0, 'resic')}<span>Stores</span>
     </div>`;
}

/* Called on every render — the strip belongs to two screens, not all five. */
export function showPurse(tab) {
  const el = $('resStrip');
  if (el) el.classList.toggle('hide', !PURSE_TABS.includes(tab));
}

export function bump(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 180);
}

export function updateRes() {
  if (!S) return;
  const el = $('rGold');
  if (el) {
    const to = S.gold, from = shownGold ?? to;
    shownGold = to;
    if (from === to) {
      el.textContent = to;
    } else {
      bump('wGold');
      const t0 = performance.now();
      (function tick(t) {
        const p = Math.min(1, (t - t0) / 450);
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }
  }

  const b = $('voyBadge');
  if (b) {
    const n = S.voyages.length, rdy = readyCount();
    if (n) { b.style.display = ''; b.textContent = rdy || n; b.className = 'badge' + (rdy ? ' rdy' : ''); }
    else b.style.display = 'none';
  }
}
