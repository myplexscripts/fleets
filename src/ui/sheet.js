/* The bottom sheet (a side drawer in landscape). Missions and results use it. */

import { $ } from '../core/dom.js';
import { render } from '../core/bus.js';
import { tutEvent } from './tutorial.js';

export function openSheet() {
  const o = $('overlay');
  held = null;
  /* Replacing innerHTML does not reset scroll, so a newly presented sheet would
     open part-scrolled wherever the previous one was left. Reset on present,
     not on write — redraws (picking a ship, selling a crate) must stay put. */
  $('sheetBody').scrollTop = 0;
  o.classList.add('on');
  requestAnimationFrame(() => o.classList.add('vis'));
}

/* The head and the foot do not scroll. Whatever the player has to keep checking
   while they choose — what the job needs, what the button will do — belongs in
   one of them, never in the middle where it scrolls out of sight. */
export function setSheetFoot(html) {
  const f = $('sheetFoot');
  f.innerHTML = html || '';
  f.classList.toggle('empty', !html);
}

/* A sheet can refuse to close. The after-action report uses this while prizes
   are still undecided — deciding is part of the fight, not a formality after
   it — so Escape and the scrim have to respect it too, not just the button. */
let held = null;
export const holdSheet = fn => { held = fn; };

export function closeSheet() {
  const o = $('overlay');
  if (!o.classList.contains('on')) return;
  if (held && held()) return;
  held = null;
  o.classList.remove('vis');
  setTimeout(() => o.classList.remove('on'), 420);
  tutEvent('sheet:close');
  render();
}

export const sheetOpen = () => $('overlay').classList.contains('on');

export function setSheet(headHTML, bodyHTML, footHTML) {
  $('sheetHead').innerHTML = headHTML;
  $('sheetBody').innerHTML = bodyHTML;
  setSheetFoot(footHTML);
}
