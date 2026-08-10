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

/* A requirement, as a ROW rather than a chip.

   The three or four readings that decide whether a job can be taken at all are
   not the same kind of thing as the eight that describe it. A chip strip makes
   them equal and makes the player scan sideways for the one that is red; a row
   states the name, what it asks, what you have, and whether you meet it — with
   the answer as a tick box at the end of the line, which is readable at a
   glance and from across the room. Everything else stays a chip. */
export function reqRow(icon, label, got, need, unit) {
  const ok = got >= need, u = unit || '';
  return `<div class="reqrow ${ok ? 'ok' : 'bad'}">`
    + iconHTML(icon, 0, 'reqic')
    + `<span class="reqlbl">${esc(label)}</span>`
    + `<span class="reqvals"><i>Need <b>${need}${u}</b></i><i>Have <b>${got}${u}</b></i></span>`
    + `<span class="reqchk">${ok ? '&#10003;' : '&#10007;'}</span>`
    + `</div>`;
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

/* ---- meters ----------------------------------------------------------
   Every bar in the game comes from here, and there is only one of them.

   There used to be six — hull, voyage, security, danger, notoriety, set
   completion — each with its own class, its own height and its own idea of
   what its fill was. They all shared one bug: the fill carried a border of
   its own, so at any height it was taller than the track it lived in and
   hung out of both ends. Chasing that in CSS six times is how you end up
   with six bars that are broken in six different ways.

   So the geometry is the fix, and it is enforced in both directions. Here:
   the percentage is coerced to a number, NaN and Infinity are floored to
   zero, and the result is clamped to 0–100 before it can reach the DOM. In
   CSS: the track clips and the fill's width is clamp(0%, --p, 100%), so a
   bad number can only ever be a wrong length, never an overflow.

   `pct` is 0–100. `tone` is one of good / warn / bad / gold / info, or a
   state word the stylesheet knows (done, full, alert). `cls` is for size
   (sm / lg) and for anything a caller needs to find it by later. */
export function meter(pct, tone, cls) {
  const n = Number(pct);
  const p = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  return `<div class="meter ${tone || ''} ${cls || ''}"`
    + ` role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"`
    + ` style="--p:${p.toFixed(1)}%"><i></i></div>`;
}

/* Hull, as a fraction of what she was built with. The tone is the reading:
   sound, hurt, or about to go down. */
export function hullBar(s) {
  const max = s.max > 0 ? s.max : 1;
  const p = s.hull / max * 100;
  return meter(p, p < 26 ? 'bad' : p < 60 ? 'warn' : 'good');
}
