/* Boot screen. Art generation is fast, but a game shows you it is loading
   rather than flashing an empty page. */

import { $ } from '../core/dom.js';
import { meter } from './format.js';

let total = 1, done = 0;

/* The loading bar is the first thing the player ever sees move, so it is the
   same meter every other bar in the game is — same track, same fill, same
   clamp. A boot screen with its own bespoke bar is the first thing telling
   them these screens were built separately. */
export function initLoading(steps) {
  total = Math.max(1, steps);
  done = 0;
  $('loadScr').innerHTML = `
    <div class="loadinner">
      <div class="loadmark">Salt <span>&amp;</span> Powder</div>
      ${meter(0, 'gold', 'sm')}
      <div class="loadmsg" id="loadMsg">Bending on sail…</div>
    </div>`;
  $('loadScr').classList.add('on');
}

function setLoad(p) {
  const bar = document.querySelector('#loadScr .meter');
  if (!bar) return;
  const v = Math.max(0, Math.min(100, p));
  bar.style.setProperty('--p', v + '%');
  bar.setAttribute('aria-valuenow', String(Math.round(v)));
}

export function loadStep(msg) {
  done++;
  setLoad(done / total * 100);
  if (msg) { const m = $('loadMsg'); if (m) m.textContent = msg; }
}

export function hideLoading() {
  const el = $('loadScr');
  setLoad(100);
  el.classList.add('out');
  setTimeout(() => { el.classList.remove('on', 'out'); el.innerHTML = ''; }, 420);
}
