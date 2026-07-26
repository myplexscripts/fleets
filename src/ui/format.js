/* Small HTML fragments shared across screens. */

import { iconHTML } from '../art/icons.js';
import { GOODS } from '../data/goods.js';
import { MATERIALS } from '../data/materials.js';

/* Order things always appear in, so a cost and a reward read the same way. */
const BAG_ORDER = ['gold', 'wood', 'metal', 'cloth'];

/* A cost or reward bag: "◉260  ▤4  ▮2" */
export function bag(o, size) {
  if (!o) return '';
  return BAG_ORDER
    .filter(k => o[k])
    .map(k => iconHTML(k, size || 19) + o[k])
    .join('  ');
}

/* Same thing — kept under both names because rewards read better as fmt(). */
export const fmt = bag;
export const costStr = bag;

/* "12 barrels of rum" */
export function goodsLine(good, qty) {
  const g = GOODS[good];
  if (!g) return qty + ' units';
  return `${qty} ${g.unit} of ${g.n.toLowerCase()}`;
}

export const goodIcon = (good, size) => iconHTML(good, size || 19);
export const matName = m => (MATERIALS[m] ? MATERIALS[m].n : m);

export function hullBar(s) {
  const p = Math.max(0, s.hull / s.max * 100);
  const c = p < 26 ? 'crit' : (p < 60 ? 'low' : '');
  return `<div class="bar"><i class="${c}" style="width:${p}%"></i></div>`;
}
