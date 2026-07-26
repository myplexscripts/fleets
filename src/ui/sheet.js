/* The bottom sheet (a side drawer in landscape). Missions and results use it. */

import { $ } from '../core/dom.js';
import { render } from '../core/bus.js';
import { tutEvent } from './tutorial.js';

export function openSheet() {
  const o = $('overlay');
  o.classList.add('on');
  requestAnimationFrame(() => o.classList.add('vis'));
}

export function closeSheet() {
  const o = $('overlay');
  if (!o.classList.contains('on')) return;
  o.classList.remove('vis');
  setTimeout(() => o.classList.remove('on'), 420);
  tutEvent('sheet:close');
  render();
}

export const sheetOpen = () => $('overlay').classList.contains('on');

export function setSheet(headHTML, bodyHTML) {
  $('sheetHead').innerHTML = headHTML;
  $('sheetBody').innerHTML = bodyHTML;
}
