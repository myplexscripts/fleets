/* The purse.

   One number and one door. Gold is the only figure worth carrying, and only on
   the two screens where money is part of the decision in front of you — Port
   and Market. Everywhere else it is a number nobody is acting on.

   It is not a header. There is no header: a bar that looked the same on every
   screen was costing a strip of a phone on all five of them. The screens that
   want a purse render one at the top of their own content, where it sticks to
   the top of the scroller rather than to the top of the game. */

import { $, qsa } from '../core/dom.js';
import { S } from '../core/state.js';
import { readyCount } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';

let shownGold = null;

/* Port draws the way into settings alongside its purse; Market does not need
   one, so the button is an option rather than part of the strip. */
export function purseHTML(opts) {
  const o = opts || {};
  return `<div class="purse">
      ${o.settings ? `<button class="iconbtn" id="pauseBtn" data-act="pause-open" aria-label="Settings"></button>` : ''}
      <div class="resitem" id="wGold" title="Gold">
        ${iconHTML('gold', 0, 'resic')}<b id="rGold">${S ? S.gold : 0}</b>
      </div>
      <div class="resitem tappable" id="wStores" title="Ship's Stores" data-act="stores">
        ${iconHTML('cargo', 0, 'resic')}<span>Stores</span>
      </div>
    </div>`;
}

export function bump(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 180);
}

export function updateRes() {
  if (!S) return;

  /* The gold readout only exists on the screens that drew one, so everything
     here is conditional rather than assumed. */
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
  } else {
    shownGold = S.gold;      // nothing on screen to animate from next time
  }

  qsa('#voyBadge').forEach(b => {
    const n = S.voyages.length, rdy = readyCount();
    if (n) { b.style.display = ''; b.textContent = rdy || n; b.className = 'badge' + (rdy ? ' rdy' : ''); }
    else b.style.display = 'none';
  });
}
