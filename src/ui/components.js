/* The component vocabulary.

   Every card, price, quantity and picker in the game is built from what is in
   this file. That is the point of it: a player learns one layout and it holds
   everywhere, so the buy button on a dock sits where the buy button on a bolt
   of cloth sat, and the ship they pick for a dive reads like the ship they
   picked for a run.

   THE RULES, which nothing may break:

     1. An item card is always  identity → what you hold → what it is →
        footer. The footer is always price on the left, actions on the right,
        and the primary action is the rightmost thing on the card. A card may
        carry a second, lesser action to the left of it — never anywhere else,
        and never above the price.
     2. A quantity is always a stepper: − amount +. Never a row of preset
        buttons, and never a free-text field.
     2b. A set of amounts that has to be read as a group — a haul, the yield of
        a choice, a ship's four numbers — is tiles, glyph over number, on a
        fixed grid so tiles in one card line up with tiles in the next. An
        amount inside a sentence stays a chip. Six chips do not fit across a
        phone at 40px a glyph; six tiles do.
     3. A set of things you choose between horizontally is a rail. It scrolls
        sideways; it never becomes a tall column that pushes the thing you are
        checking off the screen.
     4. What a choice requires goes in a requirement bar, in the panel head
        where it cannot scroll away.
     5. A panel is a full screen with three bands — head, scrolling body, foot
        holding the button. Never a drawer: a sheet leaves a strip of the screen
        behind it that is neither useful nor tappable, and makes the thing you
        came to look at smaller for nothing.

   If something does not fit these, change the rule here rather than inventing a
   one-off style in a screen. */

import { esc } from '../core/dom.js';
import { iconHTML } from '../art/icons.js';
import { chipRow } from './format.js';

/* ---- 1. item card ----------------------------------------------------
   Anything ownable, buyable or sellable. `price` and `action` may be empty for
   a card that is only showing you something. */
export function itemCard(o) {
  /* `attrs` is a raw attribute string — the world ticker finds live cards by
     data attribute, so a card has to be able to carry one. */
  const foot = (o.price || o.action)
    ? `<div class="itemfoot"><div class="itemprice">${o.price || ''}</div>`
      + `<div class="itemacts">${o.action || ''}</div></div>`
    : '';
  return `<div class="item ${o.cls || ''}"${o.id ? ` id="${o.id}"` : ''}${o.attrs || ''}>
      <div class="itemhead">
        ${o.icon ? iconHTML(o.icon, 0, 'itemic') : ''}
        <div class="itemname"><b>${esc(o.name)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>
        ${o.held || ''}
      </div>
      ${o.body ? `<div class="itembody">${o.body}</div>` : ''}
      ${foot}
    </div>`;
}

/* The button that sits in an item footer. One shape, one place. */
export function itemAction(label, act, data, opts) {
  const o = opts || {};
  const attrs = Object.keys(data || {}).map(k => ` data-${k}="${esc(String(data[k]))}"`).join('');
  return `<button class="btn sm ${o.cls || 'gold'} itemact" data-act="${act}"${attrs}`
    + `${o.disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}

/* ---- 2. stepper ------------------------------------------------------
   How many. Minus, the amount, plus — and the amount is a live readout, not an
   input, so there is nothing to mistype and nothing to validate. */
export function stepper(act, key, n, max) {
  const at = ` data-act="${act}" data-key="${esc(key)}"`;
  return `<div class="stepper">
      <button class="stepbtn"${at} data-d="-1" ${n <= 1 ? 'disabled' : ''} aria-label="One fewer">−</button>
      <span class="stepn">${n}</span>
      <button class="stepbtn"${at} data-d="1" ${max != null && n >= max ? 'disabled' : ''} aria-label="One more">+</button>
    </div>`;
}

/* ---- 3. rail ---------------------------------------------------------
   A sideways row of choices. Cards keep a fixed width so the rail always looks
   scrollable and never reflows into a column. */
export const rail = (cards, id) =>
  `<div class="rail"${id ? ` id="${id}"` : ''}>${cards}</div>`;

/* One card on a rail: a picture of the thing, its name, its numbers. */
export function railCard(o) {
  return `<div class="railcard ${o.cls || ''}"${o.attrs || ''}>
      <div class="railart">${o.art || ''}</div>
      <div class="railname">${esc(o.name)}${o.tag ? `<span class="railtag ${o.tagCls || ''}">${esc(o.tag)}</span>` : ''}</div>
      ${o.sub ? `<div class="railsub">${esc(o.sub)}</div>` : ''}
      ${o.chips || ''}
    </div>`;
}

/* ---- 4. requirement bar ----------------------------------------------
   What the job in front of you asks for.

   Two bands, because there are two kinds of reading here. The tests — can this
   fleet carry it, is it fast enough, does the bell reach — are ROWS, stated one
   per line with a tick at the end. Everything that merely describes the job —
   where it goes, how long it takes, what it pays — stays a chip strip
   underneath. Rows are what you check; chips are what you weigh. */
export function reqBar(rows, chips, note) {
  const r = (rows || []).filter(Boolean);
  const c = (chips || []).filter(Boolean);
  return `<div class="reqbar">`
    + (r.length ? `<div class="reqrows">${r.join('')}</div>` : '')
    + (c.length ? chipRow(c, 'big') : '')
    + (note ? `<div class="reqnote">${note}</div>` : '')
    + `</div>`;
}

/* A section label. The one heading style.

   `cls` exists for the one case where a heading carries a control rather than a
   reading — a label, a counter and a button is enough in a pill that sizes to
   its contents to push the label itself onto two lines. */
export const sect = (label, i, trail, cls) =>
  `<div class="sect ${cls || ''}" style="--i:${i || 0}"><span class="sectlbl">${esc(label)}</span>`
  + `${trail ? `<span class="secttrail">${trail}</span>` : ''}</div>`;

/* A grid of item cards. Items size themselves; the grid only spaces them. */
export const itemGrid = (items, cls) => `<div class="itemgrid ${cls || ''}">${items}</div>`;

/* ---- 6. the empty state ----------------------------------------------
   A screen with nothing on it is a screen the player is looking at for the
   first time, so it is the worst possible moment for the game to look
   unfinished. Every "there is nothing here yet" in the game is this one
   shape: a large faded glyph, the plain fact, and — where there is one — the
   thing to go and do about it.

   It was five different bare sentences in five different cards before, which
   is exactly the kind of small inconsistency that adds up to a game feeling
   assembled rather than designed. */
export function emptyCard(icon, text, i) {
  return `<div class="card empty" style="--i:${i || 0}">
      ${iconHTML(icon, 0, 'emptyic')}
      <p class="emptytext">${esc(text)}</p>
    </div>`;
}
