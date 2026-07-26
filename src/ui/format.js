/* Small HTML fragments shared across screens.

   The house style is a chip: one glyph, one number. A card should be readable
   at a glance without reading a sentence, so anything numeric goes through
   `chip` or `have` rather than being spelled out in prose. */

import { esc } from '../core/dom.js';
import { iconHTML } from '../art/icons.js';
import { GOODS } from '../data/goods.js';
import { MATERIALS } from '../data/materials.js';

/* Order things always appear in, so a cost and a reward read the same way. */
const BAG_ORDER = ['gold', 'wood', 'metal', 'cloth'];

/* A cost or reward bag, inline: icon then number, no chip frame. Used on
   buttons, where a framed chip inside a frame reads badly. */
export function bag(o, size) {
  if (!o) return '';
  return BAG_ORDER
    .filter(k => o[k])
    .map(k => iconHTML(k, size || 19) + o[k])
    .join('  ');
}
export const fmt = bag;
export const costStr = bag;

/* The same bag as chips, for cards. */
export function bagChips(o, cls) {
  if (!o) return '';
  return BAG_ORDER.filter(k => o[k]).map(k => chip(k, o[k], cls == null ? 'gold' : cls)).join('');
}

/* One glyph, one value. `cls` tints it: ok / bad / warn / dim. */
export function chip(icon, value, cls, title) {
  return `<span class="chip ${cls || ''}"${title ? ` title="${esc(title)}"` : ''}>` +
    iconHTML(icon, 0, 'chipic') + `<b>${value}</b></span>`;
}

/* "have / need" — the left number is what you have, the right what the job
   wants. Green when you are covered, red when you are short. */
export function have(icon, got, need, title) {
  return chip(icon, `${got}<i>/</i>${need}`, got >= need ? 'ok' : 'bad', title);
}

/* "current / max" — a level, not a test. Never red for being full. */
export function outOf(icon, cur, max, cls, title) {
  return chip(icon, `${cur}<i>/</i>${max}`, cls, title);
}

export function chipRow(list, cls) {
  const inner = list.filter(Boolean).join('');
  return inner ? `<div class="chips ${cls || ''}">${inner}</div>` : '';
}

/* The four numbers that describe any ship, in a fixed order so the eye learns
   where to look: speed, guns, hull, cargo. Pass `need` and the cargo chip turns
   into a have/need test — green if this hull can take the job, red if not. */
export function shipChips(s, extra, need) {
  return chipRow([
    chip('speed', s.speed, '', 'Speed'),
    chip('guns', s.guns, '', 'Guns'),
    outOf('hull', Math.max(0, s.hull), s.max, s.hull <= 0 ? 'bad' : (s.hull < s.max * 0.6 ? 'warn' : ''), 'Hull'),
    need == null
      ? chip('cargo', s.cargo, '', 'Cargo space')
      : have('cargo', s.cargo, need, 'Cargo space vs this consignment'),
    extra || ''
  ]);
}

/* "12 barrels of rum" — still spelled out where the words carry meaning. */
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
