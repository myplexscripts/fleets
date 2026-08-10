/* The scene bar.

   One strip along the top edge of every screen in the game, drawn by the
   shell rather than by the screens, and it does three things:

     1. It says where you are. Five scenes that each look like a different
        product is the problem this whole pass exists to fix, and a named,
        identically-placed bar is the cheapest, strongest fix available —
        wherever you are, the game is still framing you the same way.
     2. It carries the figures the scene in front of you is decided against.
        Gold everywhere, because gold is the only currency and every scene
        prices something; the door to the stores where you deal in goods.
     3. It holds the way into settings, in one place, on every screen.

   It is deliberately NOT a resource dashboard. A row of running totals above
   a chart is a spreadsheet header, not a game — everything else you own has
   a screen that says it better.

   Previously each screen that wanted a purse drew its own, sticky, inside
   its own scroller. That put a different strip at a different height on two
   of the five screens and nothing at all on the other three, and it was the
   single biggest reason the game read as five separate builds. */

import { $, qsa } from '../core/dom.js';
import { S } from '../core/state.js';
import { readyCount } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';

let shownGold = null;

/* What each scene calls itself, and which tools it needs on the bar. The
   shell owns the tab keys; this owns what a tab looks like up here. */
const BARS = {
  fleet:  { title: 'Port',     stores: true },
  flag:   { title: 'Flagship' },
  routes: { title: 'Chart' },
  voy:    { title: 'At Sea' },
  port:   { title: 'Market',   stores: true }
};

/* A figure on the bar: glyph, number, and the steel plate both sit in — the
   same plate a chip uses, one size up, so the gold up here and the gold in a
   price are recognisably the same object. */
const goldPlate = () =>
  `<div class="resitem" id="wGold" title="Gold">
     ${iconHTML('gold', 0, 'resic')}<b id="rGold">${S ? S.gold : 0}</b>
   </div>`;

const storesDoor = () =>
  `<button class="resitem tappable" id="wStores" data-act="stores"
      aria-label="Ship's Stores">
     ${iconHTML('cargo', 0, 'resic')}<span>Stores</span>
   </button>`;

const wheel = () =>
  `<button class="iconbtn" id="pauseBtn" data-act="pause-open" aria-label="Settings"></button>`;

export function renderTopbar(tab) {
  const bar = BARS[tab] || { title: '' };
  $('topbar').innerHTML = `
    <div class="scenebar">
      <h1 class="scenetitle">${bar.title}</h1>
      <div class="scenetools">
        ${goldPlate()}
        ${bar.stores ? storesDoor() : ''}
        ${wheel()}
      </div>
    </div>`;
}

export function bump(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 200);
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
  } else {
    shownGold = S.gold;      // nothing on screen to animate from next time
  }

  qsa('#voyBadge').forEach(b => {
    const n = S.voyages.length, rdy = readyCount();
    if (n) { b.style.display = ''; b.textContent = rdy || n; b.className = 'badge' + (rdy ? ' rdy' : ''); }
    else b.style.display = 'none';
  });
}
