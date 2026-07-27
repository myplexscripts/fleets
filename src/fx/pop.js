/* Pops — feedback where the finger is.

   Buying and selling do not deserve a message across the top of the screen;
   they deserve a "+3" that leaps off the button you just pressed. The
   transaction is small and local, so the confirmation is small and local, and
   the player's eye never has to leave what they are doing.

   Anything the player earned rather than bought goes through fx/award.js
   instead — that stops the game and asks to be acknowledged. */

import { iconHTML } from '../art/icons.js';

let layer = null;

function host() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'pops';
  document.body.appendChild(layer);
  return layer;
}

/* Throw a label off an element. `cls` tints it: ok / bad / gold. */
export function pop(el, text, cls, icon) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width) return;

  const n = document.createElement('div');
  n.className = 'pop ' + (cls || '');
  n.innerHTML = (icon ? iconHTML(icon, 40) : '') + text;
  /* Anchored to the top-centre of whatever was pressed. */
  n.style.left = (r.left + r.width / 2) + 'px';
  n.style.top = (r.top - 6) + 'px';
  host().appendChild(n);
  setTimeout(() => n.remove(), 1100);
}

/* The common case: a button that just did something, by its data-act. */
export function popFrom(sel, text, cls, icon) {
  pop(document.querySelector(sel), text, cls, icon);
}
