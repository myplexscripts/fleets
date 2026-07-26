/* Small HTML fragments shared across screens. */

import { iconHTML } from '../art/icons.js';
import { BOONS } from '../data/flagship.js';

/* A reward bundle: "◎260  ⚙2" */
export function fmt(o) {
  const p = [];
  if (o.reales) p.push(iconHTML('reales', 19) + o.reales);
  if (o.parts)  p.push(iconHTML('parts', 19) + o.parts);
  if (o.gems)   p.push(iconHTML('gems', 19) + o.gems);
  return p.join('  ');
}

/* A price tag, always leading with reales. */
export function costStr(c) {
  return `${iconHTML('reales', 19)}${c.reales}` +
    (c.parts ? ' ' + iconHTML('parts', 19) + c.parts : '') +
    (c.gems ? ' ' + iconHTML('gems', 19) + c.gems : '');
}

export function hullBar(s) {
  const p = Math.max(0, s.hull / s.max * 100);
  const c = p < 26 ? 'crit' : (p < 60 ? 'low' : '');
  return `<div class="bar"><i class="${c}" style="width:${p}%"></i></div>`;
}

export function prizeDesc(p) {
  if (!p) return '';
  if (p.relic) return 'Relic: ' + p.relic;
  if (p.boon) return 'Legendary refit: ' + BOONS[p.boon].n;
  if (p.gems) return 'Treasure map worth ' + p.gems + ' gems';
  return '';
}
