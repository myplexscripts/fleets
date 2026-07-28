/* Pops — feedback where the finger is.

   There are exactly three ways this game answers a player, and they are sorted
   by how much the answer is worth:

     pop / say   a small thing happened where you pressed. "+240" leaps off the
                 Sell button. Local, silent, gone in a second.
     deny        you cannot do that. Same place, red, and the control shakes so
                 the refusal is impossible to miss even if the words are.
     award       you earned something. That one stops the game and waits to be
                 acknowledged — see fx/award.js.

   What there is no longer is a notice that slides along the top of the screen
   while the player is looking at their hands. A message you can miss is a
   message that does not exist, so nothing in the game sends one. */

import { iconHTML } from '../art/icons.js';
import { actionSource } from '../core/actions.js';
import { play } from './sound.js';
import { buzz } from './haptics.js';

let layer = null;

function host() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'pops';
  document.body.appendChild(layer);
  return layer;
}

/* Throw a label off an element. `cls` tints it: ok / bad / gold.

   The label lives in a fixed layer at the coordinates the element had when it
   was pressed, so it survives the panel underneath it closing — which is
   exactly what happens when a fleet sails and the mission screen goes away. */
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
  setTimeout(() => n.remove(), 1300);
}

/* The common case: a button that just did something, by its data-act. */
export function popFrom(sel, text, cls, icon) {
  pop(document.querySelector(sel), text, cls, icon);
}

/* Whatever the player just pressed, without anyone having to pass it along. */
export function say(text, cls, icon) {
  pop(actionSource(), text, cls, icon);
}

/* "No." — the refusal, on the control that was refused.

   The shake matters as much as the words: it is visible in peripheral vision,
   it does not need reading, and it tells the player the tap registered and was
   turned down rather than being swallowed. */
export function deny(text, el) {
  const t = el || actionSource();
  pop(t, text, 'bad');
  if (t) {
    t.classList.remove('shake');
    void t.offsetWidth;                     // restart the animation
    t.classList.add('shake');
    setTimeout(() => t.classList.remove('shake'), 420);
  }
  play('deny');
  buzz('deny');
}
