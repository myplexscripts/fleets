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

/* Some steps point at one specific marker and mean it. */
export function tutAllowsMission(id) {
  const st = tutStep();
  return !st || !st.only || st.only === id;
}

/* Losing the scripted fight would otherwise strand the player on a step whose
   target is gone. Send them back to the step that opens that fight. */
export function tutRewindToCombat() {
  if (!tutActive()) return false;
  const i = TUTSTEPS.findIndex(s => s.only === 'c3');
  if (i < 0 || S.tut < i) return false;
  S.tut = i;
  save();
  refreshTut();
  return true;
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

let tutTarget = null, tutShownStep = -1;

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
    lastRect = null;
    hi.className = 'full';
    hi.style.display = 'block';
    renderTip(st);
    placeTip(null);
    tutShownStep = S.tut;
    return;
  }

  hi.className = '';
  const el = st.sel ? qs(st.sel) : null;
  if (!el) { tutTarget = null; hide(); return; }

  const fresh = tutShownStep !== S.tut || tutTarget !== el;
  tutTarget = el;
  tutShownStep = S.tut;
  if (fresh) {
    lastRect = null;
    renderTip(st);
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
  }
  /* Position on the next frame, and keep positioning — see track(). */
  requestAnimationFrame(track);
}

/* The card must follow its target. Sheets slide in, screens re-render and cards
   animate, so a rect measured once is wrong a moment later — and a stale card
   parked on top of the button it is pointing at makes the step impossible to
   complete. This runs while the tutorial is up and repositions on any move. */
let lastRect = null, trackRaf = 0;

function rectChanged(b) {
  if (!lastRect) return true;
  return Math.abs(b.top - lastRect.top) > 1 || Math.abs(b.bottom - lastRect.bottom) > 1
      || Math.abs(b.left - lastRect.left) > 1 || Math.abs(b.right - lastRect.right) > 1;
}

function track() {
  cancelAnimationFrame(trackRaf);
  if (!tutActive() || !tutTarget || !tutTarget.isConnected) { lastRect = null; return; }
  const st = TUTSTEPS[S.tut];
  if (!st || st.modal) return;

  const b = tutTarget.getBoundingClientRect();
  if (rectChanged(b)) {
    lastRect = { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    ringTrack();
    placeTip({ top: b.top, bottom: b.bottom });
  }
  trackRaf = requestAnimationFrame(track);
}

/* env(safe-area-inset-*) is not readable from JS, so a hidden probe element
   carries them as border widths. */
function safeInsets() {
  const p = $('safeProbe');
  if (!p) return { t: 0, b: 0 };
  const cs = getComputedStyle(p);
  return { t: parseFloat(cs.borderTopWidth) || 0, b: parseFloat(cs.borderBottomWidth) || 0 };
}

function renderTip(st) {
  const tip = $('tutTip');
  tip.innerHTML = `
    <div class="ttbody"><div class="tt">${esc(st.title)}</div><div class="tx">${esc(st.text)}</div></div>
    <div class="ttfoot">
      ${st.btn ? `<button class="btn sm gold" data-act="tut-next">${esc(st.btn)}</button>`
               : '<span class="sub" style="font-style:italic;flex:1">Do it to continue…</span>'}
      <button class="skiplink" data-act="tut-skip">Skip</button>
    </div>`;
  tip.style.display = 'flex';
}

function placeTip(r) {
  const tip = $('tutTip');
  tip.style.display = 'flex';

  const ins = safeInsets(), pad = 12;
  const topLim = ins.t + pad, botLim = innerHeight - ins.b - pad;
  const band = Math.max(170, botLim - topLim);

  if (!r) {
    /* Modal step: centred, and the full-screen scrim behind it is the point. */
    tip.style.maxHeight = Math.round(band * 0.82) + 'px';
    const th = tip.offsetHeight;
    tip.style.top = Math.round(topLim + Math.max(0, (band - th) / 2)) + 'px';
    return;
  }

  /* The card must never cover the element it is pointing at — the player has to
     be able to tap that element to continue. So it is capped to the space on
     whichever side has more of it, which makes overlap impossible. */
  const above = Math.max(0, r.top - pad - topLim);
  const below = Math.max(0, botLim - (r.bottom + pad));
  const dockBottom = below >= above;
  const room = dockBottom ? below : above;

  const MIN_CARD = 96;
  if (room < MIN_CARD) {
    /* Target is too tall to sit beside. Pin the card to the far edge from the
       target's middle so it covers as little of it as possible. */
    tip.style.maxHeight = Math.round(Math.min(band * 0.42, 260)) + 'px';
    const th = tip.offsetHeight;
    const targetMid = (r.top + r.bottom) / 2;
    tip.style.top = Math.round(targetMid > innerHeight / 2 ? topLim : botLim - th) + 'px';
    return;
  }

  tip.style.maxHeight = Math.round(Math.max(MIN_CARD, Math.min(room, band * 0.55))) + 'px';
  const th = tip.offsetHeight;
  const top = dockBottom ? (r.bottom + pad) : (r.top - pad - th);
  tip.style.top = Math.round(Math.min(Math.max(topLim, top), Math.max(topLim, botLim - th))) + 'px';
}

export function initTutorial() {
  action('tut-next', tutNext);
  action('tut-skip', finishTut);
  addEventListener('resize', refreshTut);
  addEventListener('scroll', () => { if (tutActive() && tutTarget) track(); }, true);
}
