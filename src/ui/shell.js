/* Screen router, bottom nav, and the one-second world ticker. */

import { $, qsa, now } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { on } from '../core/bus.js';
import { action } from '../core/actions.js';
import { anyBossReady, readyCount, fmtDur } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { updateRes, renderTopbar } from './hud.js';
import { wipe } from '../fx/wipe.js';
import { deny, pop } from '../fx/pop.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';
import { refreshTut, tutLockedTab, tutEvent } from './tutorial.js';
import { renderPort } from './screens/port.js';
import { renderFlagship } from './screens/flagship.js';
import { renderMap } from './screens/map.js';
import { renderSea } from './screens/sea.js';
import { renderMarket } from './screens/market.js';

/* key, nav id, label, icon, renderer */
export const SCREENS = [
  { key: 'fleet',  id: 'tabFleet',  label: 'Port',     icon: 'port',   render: renderPort },
  { key: 'flag',   id: 'tabFlag',   label: 'Flagship', icon: 'flag',   render: renderFlagship },
  { key: 'routes', id: 'tabRoutes', label: 'Map',      icon: 'map',    render: renderMap },
  { key: 'voy',    id: 'tabVoy',    label: 'At Sea',   icon: 'sea',    render: renderSea },
  { key: 'port',   id: 'tabPort',   label: 'Market',   icon: 'scales', render: renderMarket }
];

let tab = 'fleet';
export const currentTab = () => tab;

/* The nav rail.

   Icon AND label, on every tab, always. The labels were taken out at some
   point to save vertical space, which left five circles that differ only by
   a small monochrome glyph and left "which one am I on" resting entirely on
   a swap between two similar-value browns. A word is the cheapest, clearest
   state and identity cue there is, and the rail is still shorter than the
   labelled bar most games ship.

   `aria-current="page"` is set alongside the `on` class rather than instead
   of it: the class drives the four visual cues (material, marker, label
   colour, elevation) and the attribute is the same fact for anyone using a
   screen reader. Neither is a substitute for the other. */
export function buildNav() {
  $('nav').innerHTML = SCREENS.map(s =>
    `<button id="${s.id}" data-act="goto" data-tab="${s.key}" type="button">
       <span class="navcircle">${iconHTML(s.icon, 0, 'navic')}</span>
       <span class="navlbl">${s.label}</span>
       ${s.key === 'voy' ? '<span class="badge" id="voyBadge" style="display:none" aria-hidden="true">0</span>' : ''}
     </button>`).join('');
}

export function gotoTab(t, immediate) {
  if (t === tab) return;
  const locked = tutLockedTab();
  if (locked && locked !== t) {
    deny('Finish this step first');
    return;
  }
  const swap = () => { tab = t; render(); tutEvent('tab:' + t); };
  if (immediate) swap(); else wipe(swap);
}

/* The last tab we actually painted. render() also runs on the world ticker, so
   scroll may only be reset when the screen underneath the player has genuinely
   changed — resetting on every repaint would yank the page out from under
   somebody halfway down their fleet once a second. */
let paintedTab = null;

export function render() {
  if (!S) return;

  qsa('nav button').forEach(b => {
    b.classList.remove('on', 'alert');
    b.removeAttribute('aria-current');
  });
  const cur = SCREENS.find(s => s.key === tab) || SCREENS[0];
  const btn = $(cur.id);
  if (btn) { btn.classList.add('on'); btn.setAttribute('aria-current', 'page'); }
  /* Nudge the player toward the chart when an admiral is waiting. */
  if (anyBossReady() && tab !== 'routes') $('tabRoutes').classList.add('alert');

  /* The bar is drawn before the scene, so the scene's own render can find it
     already in the document, and after the tab has been decided, so it is
     naming the screen the player is about to be looking at. */
  renderTopbar(tab);
  updateRes();

  $('main').className = tab === 'routes' ? 'nopad' : '';
  cur.render();

  /* A new screen starts at the top of itself. Carrying the old screen's scroll
     across lands you halfway down a page you have never seen. */
  if (paintedTab !== tab) {
    $('main').scrollTop = 0;
    paintedTab = tab;
  }

  save();
  refreshTut();
}

/* A fresh game or a reload starts clean. */
export function resetScroll() { paintedTab = null; }

/* ---- ticker ---------------------------------------------------------- */

let lastReady = 0;
let mapRaf = 0;

export function startTicker() {
  setInterval(() => {
    if (!S) return;
    const rdy = readyCount();

    /* Countdowns are patched in place — re-rendering every second would fight
       the player's scroll position and restart card animations. */
    qsa('.clock[data-endsat]').forEach(el => {
      const left = (+el.dataset.endsat - now()) / 1000;
      if (left > 0) { el.textContent = fmtDur(left); el.classList.remove('done'); return; }
      /* Most countdowns are a thing arriving, and say so. Some are a thing
         wearing off — a patrol that has run out has nothing to announce, it
         just stops being true, so it takes its badge with it. */
      const host = el.dataset.gone && el.closest(el.dataset.gone);
      if (host) host.remove();
      else { el.textContent = 'READY'; el.classList.add('done'); }
    });
    /* A voyage meter is patched in place too, and it is patched the same way
       the markup built it: by setting --p, never by writing a width. An
       inline width would beat the stylesheet's clamp and put the bar's one
       guarantee — that it cannot leave its track — back in the hands of
       whatever this arithmetic happens to produce. */
    qsa('[data-voy] .voybar').forEach(bar => {
      const card = bar.closest('[data-voy]');
      const v = S.voyages.find(x => x.id === card.dataset.voy);
      if (!v) return;
      const tot = (v.endsAt - v.startedAt) / 1000;
      const left = (v.endsAt - now()) / 1000;
      const p = tot > 0 ? Math.max(0, Math.min(100, (1 - left / tot) * 100)) : 100;
      bar.style.setProperty('--p', p.toFixed(1) + '%');
      bar.setAttribute('aria-valuenow', String(Math.round(p)));
    });

    /* Render exactly once, on the transition to "a fleet has docked".

       The notice is the nav rail itself: the At Sea tab takes a green badge and
       throws the word up off its own icon, so it is announced where the player
       has to go rather than somewhere they have to have been looking. */
    if (rdy > lastReady) {
      play('arrive');
      buzz('win');
      if (tab !== 'voy') pop($('tabVoy'), 'Docked', 'ok', 'anchor');
      if (tab === 'voy' || tab === 'fleet') render();
    }
    lastReady = rdy;
    updateRes();
  }, 1000);

  setInterval(() => { if (S) save(); }, 15000);

  addEventListener('visibilitychange', () => {
    if (document.hidden || !S) return;
    updateRes();
    if (tab === 'voy' || tab === 'fleet' || tab === 'routes') render();
  });

  addEventListener('resize', () => {
    if (tab !== 'routes') return;
    cancelAnimationFrame(mapRaf);
    mapRaf = requestAnimationFrame(renderMap);
  });
}

export function resetTicker() { lastReady = readyCount(); }

/* Screens ask for a repaint through the bus so they never import this file. */
on('render', render);
on('res', updateRes);

action('goto', d => gotoTab(d.tab));
