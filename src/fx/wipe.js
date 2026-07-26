/* Scene transition: two skewed panels sweep across, and the callback fires
   while the screen is covered. Every screen change goes through this — it is
   most of what stops the game reading like a set of web pages. */

import { $, reflow } from '../core/dom.js';
import { play } from './sound.js';

let wiping = false;

export function wipe(mid) {
  if (wiping) { if (mid) mid(); return; }
  wiping = true;
  const w = $('wipe');
  play('sail');
  w.classList.remove('go');
  reflow(w);
  w.classList.add('go');
  setTimeout(() => { if (mid) mid(); }, 330);
  setTimeout(() => { w.classList.remove('go'); wiping = false; }, 700);
}
