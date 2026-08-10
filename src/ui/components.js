/* The component vocabulary.

   Every card, price, quantity and picker in the game is built from what is in
   this file. That is the point of it: a player learns one layout and it holds
   everywhere, so the buy button on a dock sits where the buy button on a bolt
   of cloth sat, and the ship they pick for a dive reads like the ship they
   picked for a run.

   THE RULES, which nothing may break:

     1. ONE SCROLL AXIS. A screen scrolls vertically and nothing inside it
        scrolls sideways. Sideways rails inside a vertical page were the worst
        thing about the previous build: a screen that scrolls two ways has no
        reading order, the rail always clips its own cards at the fold, and
        the player cannot tell whether they have seen everything. A set of
        things is a LIST, however many of them there are.
     2. A list row is always identity → what it is → footer. The footer is
        always price on the left, actions on the right, primary action
        rightmost. A row may carry a second, lesser action to the left of the
        primary — never anywhere else, and never above the price.
     3. A quantity is always a stepper: − amount +. Never a row of preset
        buttons, and never a free-text field.
     4. A ship's numbers are the stat strip: five readings on one line, glyph
        over number, in a fixed order so the eye learns where to look.
     5. What a choice requires goes in a requirement bar, in the panel head
        where it cannot scroll away.
     6. A panel is a full screen with three bands — head, scrolling body, foot
        holding the button.

   If something does not fit these, change the rule here rather than inventing
   a one-off style in a screen. */

import { esc } from '../core/dom.js';
import { iconHTML } from '../art/icons.js';

/* ---- 1. the list row -------------------------------------------------
   Anything ownable, buyable or sellable. `price` and `action` may be empty
   for a row that is only showing you something. */
export function itemCard(o) {
  const foot = (o.price || o.action)
    ? `<div class="rowfoot"><div class="rowprice">${o.price || ''}</div>`
      + `<div class="rowacts">${o.action || ''}</div></div>`
    : '';
  return `<div class="listrow ${o.cls || ''}${o.cls ? ' flagged' : ''}"`
    + `${o.id ? ` id="${o.id}"` : ''}${o.attrs || ''}>
      <div class="rowhead">
        ${o.icon ? iconHTML(o.icon, 0, 'rowic') : ''}
        <div class="rowname"><b>${esc(o.name)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>
        ${o.held ? `<div class="rowtrail">${o.held}</div>` : ''}
      </div>
      ${o.body ? `<div class="rowbody">${o.body}</div>` : ''}
      ${foot}
    </div>`;
}

/* The button that sits in a row's footer. One shape, one place. */
export function itemAction(label, act, data, opts) {
  const o = opts || {};
  const attrs = Object.keys(data || {}).map(k => ` data-${k}="${esc(String(data[k]))}"`).join('');
  return `<button class="btn sm ${o.cls || 'gold'}" data-act="${act}"${attrs}`
    + `${o.disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}

/* A list of rows. `cls` used to carry 'rail' to make the set scroll sideways;
   it is accepted and ignored, so a screen asking for one gets a list. */
export const itemGrid = (items, cls) => `<div class="list">${items}</div>`;

/* ---- 2. stepper ------------------------------------------------------
   How many. Minus, the amount, plus — and the amount is a live readout, not
   an input, so there is nothing to mistype and nothing to validate. */
export function stepper(act, key, n, max) {
  const at = ` data-act="${act}" data-key="${esc(key)}"`;
  return `<div class="stepper">
      <button class="stepbtn"${at} data-d="-1" ${n <= 1 ? 'disabled' : ''} aria-label="One fewer">−</button>
      <span class="stepn">${n}</span>
      <button class="stepbtn"${at} data-d="1" ${max != null && n >= max ? 'disabled' : ''} aria-label="One more">+</button>
    </div>`;
}

/* ---- 3. the picker ---------------------------------------------------
   A set of things you choose between: ships for a job, mostly.

   A VERTICAL list. It used to be a sideways rail, on the theory that it kept
   the requirement bar on screen while you looked through the fleet — but a
   rail that has to fit a ship's picture, her name, her class and five numbers
   makes a card 200px wide and 330px tall, so on a phone you saw one and a
   half of them and the second one was cut down its middle by the panel frame.
   A row shows the same ship in 68px of height, and six of them fit where one
   and a half card did. */
export const rail = (rows, id) =>
  `<div class="picklist"${id ? ` id="${id}"` : ''}>${rows}</div>`;

/* One row of the picker: her order in the line, her picture, her name, what
   she is, and the numbers that decide it. */
export function pickRow(o) {
  const tag = o.tag
    ? `<span class="chip ${o.tagCls === 'bad' ? 'bad' : o.tagCls === 'blu' ? 'dim' : 'gold'}"><b>${esc(o.tag)}</b></span>`
    : '';
  return `<button class="pickrow ${o.cls || ''}"${o.attrs || ''} type="button">
      <span class="pickmark">${o.mark || ''}</span>
      <span class="pickart">${o.art || ''}</span>
      <span class="pickmeta">
        <b>${esc(o.name)}</b>
        ${o.sub ? `<span class="picksub">${esc(o.sub)}</span>` : ''}
        ${o.chips || tag ? `<span class="chips tight">${tag}${o.chips || ''}</span>` : ''}
      </span>
    </button>`;
}
/* the name the screens already call it by */
export const railCard = pickRow;

/* ---- 4. requirement bar ----------------------------------------------
   What the job in front of you asks for.

   Two bands, because there are two kinds of reading. The tests — can this
   fleet carry it, is it fast enough, does the bell reach — are ROWS, one per
   line with a tick at the end. Everything that merely describes the job —
   where it goes, how long it takes, what it pays — stays a chip strip
   underneath. Rows are what you check; chips are what you weigh. */
export function reqBar(rows, chips, note) {
  const r = (rows || []).filter(Boolean);
  const c = (chips || []).filter(Boolean);
  return `<div class="reqbar">`
    + (r.length ? `<div class="reqrows">${r.join('')}</div>` : '')
    + (c.length ? `<div class="chips">${c.join('')}</div>` : '')
    + (note ? `<div class="reqnote">${note}</div>` : '')
    + `</div>`;
}

/* ---- 5. a section heading --------------------------------------------
   A label, a rule out to the right edge, and whatever counter or control the
   section owns sitting at the end of it. `cls` is accepted for callers that
   used to distinguish a heading carrying a control; it needs no distinction
   now, because the rule absorbs whatever room is left. */
export const sect = (label, i, trail, cls) =>
  `<div class="sect ${cls || ''}" style="--i:${i || 0}"><span class="sectlbl">${esc(label)}</span>`
  + `${trail ? `<span class="secttrail">${trail}</span>` : ''}</div>`;

/* ---- 6. the empty state ----------------------------------------------
   A screen with nothing on it is a screen the player is looking at for the
   first time, so it is the worst possible moment for the game to look
   unfinished. One shape, everywhere: a large faded glyph and the plain fact. */
export function emptyCard(icon, text, i) {
  return `<div class="card empty" style="--i:${i || 0}">
      ${iconHTML(icon, 0, 'emptyic')}
      <p class="emptytext">${esc(text)}</p>
    </div>`;
}

/* ---- 7. level pips ---------------------------------------------------
   How many of a thing you have bought, out of how many there are. Drawn as
   discs rather than typed as ●○ characters, so they cannot pick up a font's
   own idea of how big a bullet is. */
export const pips = (have, max) =>
  `<span class="pips">${Array.from({ length: max },
    (_, n) => `<i class="${n < have ? 'on' : ''}"></i>`).join('')}</span>`;
