/* Tutorial runtime: a spotlight ring over a target element plus a tip card
   docked above or below it, whichever has room. */

import { $, qs, esc } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { TUT_KEY } from '../core/config.js';
import { TUTSTEPS } from '../data/tutorial.js';
import { action } from '../core/actions.js';

/* Named preconditions referenced by TUTSTEPS.when */
const WHEN = {
  battle: () => $('battleScr').classList.contains('on'),
  prize: () => $('overlay').classList.contains('on') && !!$('cap0')
};

export const tutActive = () => !!S && typeof S.tut === 'number';
export const tutStep = () => (tutActive() ? TUTSTEPS[S.tut] : null);

/* Which screen the tutorial is pinning the player to, if any. */
export function tutLockedTab() {
  const st = tutStep();
  return st && st.lockTab ? st.lockTab : null;
}

export function tutEvent(ev) {
  if (!tutActive()) return;
  /* Look a couple of steps ahead so an event fired slightly early still counts. */
  for (let i = S.tut; i < Math.min(S.tut + 3, TUTSTEPS.length); i++) {
    const w = TUTSTEPS[i].wait;
    if (w && (Array.isArray(w) ? w.includes(ev) : w === ev)) {
      S.tut = i + 1;
      save();
      refreshTut();
      return;
    }
  }
}

export function tutNext() {
  if (!tutActive()) return;
  S.tut++;
  save();
  if (S.tut >= TUTSTEPS.length) finishTut();
  else refreshTut();
}

export function finishTut() {
  S.tut = 'done';
  try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { /* ignore */ }
  save();
  $('tutHi').style.display = 'none';
  $('tutTip').style.display = 'none';
}

/* Replay from the top — offered in the pause menu. */
export function restartTut() {
  S.tut = 0;
  try { localStorage.removeItem(TUT_KEY); } catch (e) { /* ignore */ }
  save();
  refreshTut();
}

let tutTarget = null, tutRaf = 0, tutShownStep = -1;

function ringTrack() {
  const hi = $('tutHi');
  if (!tutActive() || !tutTarget || !tutTarget.isConnected) return;
  const b = tutTarget.getBoundingClientRect();
  if (!b.width || b.bottom <= 2 || b.top >= innerHeight - 2) { hi.style.display = 'none'; return; }
  const L = Math.max(4, b.left - 6), T = Math.max(4, b.top - 6);
  const R = Math.min(innerWidth - 4, b.right + 6), B = Math.min(innerHeight - 4, b.bottom + 6);
  hi.style.display = 'block';
  hi.style.left = L + 'px';
  hi.style.top = T + 'px';
  hi.style.width = Math.max(0, R - L) + 'px';
  hi.style.height = Math.max(0, B - T) + 'px';
}

export function refreshTut() {
  const hi = $('tutHi'), tip = $('tutTip');
  const hide = () => { hi.style.display = 'none'; tip.style.display = 'none'; };
  if (!tutActive()) { tutTarget = null; hide(); return; }
  if (S.tut >= TUTSTEPS.length) { finishTut(); return; }

  /* Never fight the victory banner or a dialog for the screen. */
  const bn = $('banner');
  if (bn && bn.classList.contains('on')) { hide(); return; }
  const dlg = $('dialogs');
  if (dlg && dlg.classList.contains('on')) { hide(); return; }

  const st = TUTSTEPS[S.tut];
  if (st.when && !(WHEN[st.when] && WHEN[st.when]())) { hide(); return; }

  if (st.modal) {
    tutTarget = null;
    hi.className = 'full';
    hi.style.display = 'block';
    showTip(null, st);
    tutShownStep = S.tut;
    return;
  }

  hi.className = '';
  const el = st.sel ? qs(st.sel) : null;
  if (!el) { tutTarget = null; hide(); return; }
  tutTarget = el;

  const fresh = tutShownStep !== S.tut;
  tutShownStep = S.tut;
  if (fresh) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }

  requestAnimationFrame(() => {
    ringTrack();
    const b = el.getBoundingClientRect();
    showTip({ top: b.top, bottom: b.bottom }, st);
  });
}

/* env(safe-area-inset-*) is not readable from JS, so a hidden probe element
   carries them as border widths. */
function safeInsets() {
  const p = $('safeProbe');
  if (!p) return { t: 0, b: 0 };
  const cs = getComputedStyle(p);
  return { t: parseFloat(cs.borderTopWidth) || 0, b: parseFloat(cs.borderBottomWidth) || 0 };
}

function showTip(r, st) {
  const tip = $('tutTip');
  tip.innerHTML = `
    <div class="ttbody"><div class="tt">${esc(st.title)}</div><div class="tx">${esc(st.text)}</div></div>
    <div class="ttfoot">
      ${st.btn ? `<button class="btn sm gold" data-act="tut-next">${esc(st.btn)}</button>`
               : '<span class="sub" style="font-style:italic;flex:1">Do it to continue…</span>'}
      <button class="skiplink" data-act="tut-skip">Skip</button>
    </div>`;
  tip.style.display = 'flex';

  const ins = safeInsets(), pad = 12;
  const topLim = ins.t + pad, botLim = innerHeight - ins.b - pad;
  const band = Math.max(170, botLim - topLim);
  tip.style.maxHeight = Math.round(band * (r ? 0.52 : 0.82)) + 'px';

  let th = tip.offsetHeight, top;
  if (!r) {
    top = topLim + Math.max(0, (band - th) / 2);
  } else {
    const above = Math.max(0, r.top - pad - topLim);
    const below = Math.max(0, botLim - (r.bottom + pad));
    const dockBottom = below >= above, room = dockBottom ? below : above;
    if (room > 190) {
      tip.style.maxHeight = Math.round(Math.min(room, band * 0.52)) + 'px';
      th = tip.offsetHeight;
    }
    top = dockBottom ? botLim - th : topLim;
  }
  tip.style.top = Math.round(Math.min(Math.max(topLim, top), Math.max(topLim, botLim - th))) + 'px';
}

export function initTutorial() {
  action('tut-next', tutNext);
  action('tut-skip', finishTut);
  addEventListener('resize', refreshTut);
  addEventListener('scroll', () => {
    if (!tutActive() || !tutTarget) return;
    cancelAnimationFrame(tutRaf);
    tutRaf = requestAnimationFrame(ringTrack);
  }, true);
}
