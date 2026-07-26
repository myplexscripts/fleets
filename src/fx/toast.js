/* Transient notices, stacked top-centre. */

import { $ } from '../core/dom.js';
import { play } from './sound.js';

export function toast(msg, type) {
  const host = $('toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;                       // textContent: never trust callers with HTML
  host.appendChild(t);
  play(type === 'gold' ? 'coin' : 'toast');
  setTimeout(() => {
    t.classList.add('bye');
    setTimeout(() => t.remove(), 260);
  }, 3000);
}
