/* Awards — the good news, presented as good news.

   A toast slides past whether you were looking or not, which is fine for "not
   enough gold" and wrong for "you have charted a new port". Anything the player
   earned stops the game and waits to be acknowledged: a card, the thing itself
   drawn large, and a button to take it.

   Losing an award to a toast the player blinked at is losing the moment the
   whole loop is built to produce, so this is deliberately interruptive. */

import { $, esc, reflow } from '../core/dom.js';
import { iconHTML } from '../art/icons.js';
import { chipRow } from '../ui/format.js';
import { play } from './sound.js';
import { buzz } from './haptics.js';

let queue = [];
let showing = false;

function host() {
  let el = $('awards');
  if (!el) {
    el = document.createElement('div');
    el.id = 'awards';
    document.body.appendChild(el);
  }
  return el;
}

/* { icon, kind, title, text, chips, sound } — kind is the small label above the
   name ("New Port", "Collectible", "Refit"). */
export function award(o) {
  queue.push(o);
  if (!showing) next();
}

function next() {
  const o = queue.shift();
  if (!o) { showing = false; return; }
  showing = true;

  const h = host();
  h.innerHTML = `<div class="awardcard" role="dialog" aria-modal="true">
      <div class="awardglow"></div>
      <div class="awardic">${iconHTML(o.icon || 'star', 0, 'awardimg')}</div>
      ${o.kind ? `<div class="awardkind">${esc(o.kind)}</div>` : ''}
      <div class="awardname">${esc(o.title)}</div>
      ${o.text ? `<div class="awardtext">${esc(o.text)}</div>` : ''}
      ${o.chips ? chipRow(o.chips, 'big') : ''}
      <button class="btn gold wide awardok" data-award-ok>${esc(o.ok || 'Take It')}</button>
    </div>`;
  h.classList.add('on');
  reflow(h);
  h.classList.add('vis');
  play(o.sound || 'relic');
  buzz('win');

  const close = () => {
    h.classList.remove('vis');
    setTimeout(() => {
      h.classList.remove('on');
      h.innerHTML = '';
      next();
    }, 260);
  };
  h.onclick = ev => { if (ev.target.closest('[data-award-ok]')) close(); };
  setTimeout(() => {
    const b = h.querySelector('.awardok');
    if (b) b.focus();
  }, 60);
}

export const awardOpen = () => !!showing;

/* Called by the global key handler so Enter and Escape both acknowledge. */
export function awardKey(ev) {
  if (!showing) return false;
  if (ev.key === 'Enter' || ev.key === 'Escape' || ev.key === ' ') {
    const b = $('awards').querySelector('.awardok');
    if (b) b.click();
  }
  return true;   // swallow everything else while an award is up
}
