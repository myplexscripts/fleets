/* Small HTML fragments shared across screens.

   The house style is a chip: one glyph, one number. A card should be readable
   at a glance without reading a sentence, so anything numeric goes through
   `chip` or `have` rather than being spelled out in prose. */

import { esc } from '../core/dom.js';
import { S } from '../core/state.js';
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

/* A price, as what you hold over what it costs — one chip per part, green where
   you are covered and red where you are short. Every transaction in the game
   shows its cost this way, so "can I afford this" is never a question. */
export function priceChips(cost) {
  if (!cost) return '';
  return chipRow(BAG_ORDER.filter(k => cost[k]).map(k =>
    have(k, k === 'gold' ? S.gold : S.mats[k], cost[k], k === 'gold' ? 'Gold' : matName(k))), 'tight');
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

/* A tile: the glyph over the number instead of beside it.

   A chip is the right shape for a line of prose and the wrong shape for a row
   of winnings — six chips will not fit across a phone with 40px glyphs, six
   tiles will. Anywhere a set of amounts has to line up as a group, it is tiles;
   anywhere an amount sits in a sentence, it is a chip. */
export function tile(icon, value, cls, title) {
  return `<span class="tile ${cls || ''}"${title ? ` title="${esc(title)}"` : ''}>` +
    iconHTML(icon, 0, 'tileic') + `<b>${value}</b></span>`;
}

export function tileRow(list, cls) {
  const inner = list.filter(Boolean).join('');
  return inner ? `<div class="tiles ${cls || ''}">${inner}</div>` : '';
}

/* A cost or reward bag as tiles, in the fixed order. */
export function bagTiles(o, cls) {
  if (!o) return '';
  return BAG_ORDER.filter(k => o[k]).map(k => tile(k, o[k], cls || '')).join('');
}

export function chipRow(list, cls) {
  const inner = list.filter(Boolean).join('');
  return inner ? `<div class="chips ${cls || ''}">${inner}</div>` : '';
}

/* The numbers that describe any ship, in a fixed order so the eye learns where
   to look: speed, guns, hull, cargo, and what she is worth in a fight.

   Tiles, not chips — this is rule 2b exactly. Five chips wrap onto three lines
   on a phone at 40px a glyph, which turns every ship card into a wall; five
   tiles sit on one grid row and line up with the tiles on the ship beside her,
   so two hulls can be compared by looking down a column.

   Pass `need` and the cargo tile becomes a have/need test — green if this hull
   can take the job, red if it cannot. */
export function shipTiles(s, power, need) {
  return tileRow([
    tile('speed', s.speed, '', 'Speed'),
    tile('guns', s.guns, '', 'Guns'),
    tile('hull', `${Math.max(0, s.hull)}<i>/</i>${s.max}`,
      s.hull <= 0 ? 'bad' : (s.hull < s.max * 0.6 ? 'warn' : ''), 'Hull'),
    need == null
      ? tile('cargo', s.cargo, '', 'Cargo space')
      : tile('cargo', `${s.cargo}<i>/</i>${need}`, s.cargo >= need ? 'ok' : 'bad',
        'Cargo space vs this consignment'),
    power == null ? '' : tile('power', power, '', 'Power')
  ], 'grid5');
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
