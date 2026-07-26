/* Boot screen. Art generation is fast, but a game shows you it is loading
   rather than flashing an empty page. */

import { $ } from '../core/dom.js';

let total = 1, done = 0;

export function initLoading(steps) {
  total = Math.max(1, steps);
  done = 0;
  $('loadScr').innerHTML = `
    <div class="loadinner">
      <div class="loadmark">Salt <span>&amp;</span> Powder</div>
      <div class="loadbar"><i id="loadFill"></i></div>
      <div class="loadmsg" id="loadMsg">Bending on sail…</div>
    </div>`;
  $('loadScr').classList.add('on');
}

export function loadStep(msg) {
  done++;
  const fill = $('loadFill');
  if (fill) fill.style.width = Math.min(100, Math.round(done / total * 100)) + '%';
  if (msg) { const m = $('loadMsg'); if (m) m.textContent = msg; }
}

export function hideLoading() {
  const el = $('loadScr');
  const fill = $('loadFill');
  if (fill) fill.style.width = '100%';
  el.classList.add('out');
  setTimeout(() => { el.classList.remove('on', 'out'); el.innerHTML = ''; }, 420);
}
