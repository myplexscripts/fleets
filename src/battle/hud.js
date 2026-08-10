/* Battle chrome: the heading, the running log, the four things you can do, and
   the end banner.

   The order bar used to hold six buttons, two of which — Focus Fire and Spread
   Fire — meant "shoot at them", chosen once per round forever. The guns look
   after themselves now, so what is left is only the things that are actually
   decisions, each with a state the player has to read before pressing it:
   whether the brace is off cooldown, whether that ship is beaten down far
   enough to board, whether a barrel is worth spending here. */

import { $ } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { iconHTML } from '../art/icons.js';
import { updateRes } from '../ui/hud.js';
import { refreshTut } from '../ui/tutorial.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';
import { BT, aliveE, aliveP, boardable } from './state.js';
import { hasFit } from '../core/selectors.js';
/* The account is built after the battle is over, so what the fight itself
   handed over has to be parked somewhere until then. result.js imports nothing
   from battle/, so this does not close a cycle. */
import { carry } from '../ui/result.js';

/* What the player can do, in display order. `hot` is the keyboard shortcut. */
export const ORDERS = [
  { id: 'brace',   label: 'Brace',   hot: '1', icon: 'plate' },
  { id: 'board',   label: 'Board',   hot: '2', icon: 'crew' },
  { id: 'barrels', label: 'Barrels', hot: '3', icon: 'barrels' },
  { id: 'retreat', label: 'Retreat', hot: '4', icon: 'sea', cls: 'red' }
];

/* Log lines: newest last, two at a time. The log floats over the water, so
   every line it keeps is a line of the battle it covers up. */
export function blog(m, c) {
  if (!BT.b) return;
  BT.b.log.push({ m, c });
  if (BT.b.log.length > 2) BT.b.log.shift();
  const el = $('blog');
  if (el) el.innerHTML = BT.b.log.map(l => `<div class="${l.c || ''}">${l.m}</div>`).join('');
}

/* The bar is redrawn from the clock, so it only writes when something has
   actually changed. Rebuilding this innerHTML sixty times a second would
   restart every button's press animation and make them feel unresponsive. */
let sig = '';

function orderState(o) {
  const b = BT.b;
  if (o.id === 'brace') {
    if (b.brace > 0) return { on: true, note: Math.ceil(b.brace / 1000) + 's' };
    if (b.braceCd > 0) return { dis: true, note: Math.ceil(b.braceCd / 1000) + 's' };
    return {};
  }
  if (o.id === 'board') {
    if (b.boardCd > 0) return { dis: true, note: Math.ceil(b.boardCd / 1000) + 's' };
    return boardable(hasFit('grapple')) ? { ready: true } : { dis: true };
  }
  if (o.id === 'barrels') return S.barrels ? { note: String(S.barrels) } : { dis: true };
  return {};
}

export function drawHud() {
  const b = BT.b;
  if (!b) return;

  const states = ORDERS.map(orderState);
  const next = [
    b.telegraph ? 'T' : '', b.brace > 0 ? 'B' : '',
    aliveE().length, aliveP().length,
    states.map(s => [s.on ? 1 : 0, s.dis ? 1 : 0, s.ready ? 1 : 0, s.note || ''].join('')).join('|')
  ].join('/');
  if (next === sig) return;
  sig = next;

  $('bTitle').textContent = b.boss ? b.boss.n : 'Broadsides';
  $('bHint').innerHTML = b.telegraph
    ? `<span class="warn">${b.boss.n} is running out her lower deck — BRACE</span>`
    : (b.brace > 0
      ? '<span class="warn">Braced — holding on, not serving the guns</span>'
      : 'The guns fire themselves. Tap a ship to aim at her.');

  $('bcmds').innerHTML = ORDERS.map((o, i) => {
    const st = states[i];
    const cls = [o.cls || '', st.on ? 'on' : '', st.ready ? 'ready' : ''].filter(Boolean).join(' ');
    return `<button class="btn sm ${cls}" ${st.dis ? 'disabled' : ''} data-act="order" data-order="${o.id}">
      <span class="hot">${o.hot}</span>${iconHTML(o.icon, 40)}<span class="olbl">${o.label}</span>
      ${st.note ? `<span class="onote">${st.note}</span>` : ''}</button>`;
  }).join('');

  refreshTut();
}

/* Nothing locks input any more — the clock does not wait for anybody. Kept so
   the keyboard layer and the tutorial have a stable shape to talk to. */
export function lockOrders(on) { BT.busy = !!on; }

export function showBanner(kind) {
  const b = BT.b, el = $('banner');
  const win = kind === 'win', isBoss = !!b.boss;
  sig = '';
  refreshTut();

  if (win) {
    const before = S.barrels;
    S.barrels = Math.min(9, S.barrels + 1);
    /* The banner used to list what a win was worth — a barrel, the prizes
       waiting, an admiral's title — and then the report listed the haul, and
       then the account totalled it. The same win announced three times, in
       three formats, none of them the total. The banner is the verdict now and
       nothing else; everything it was reporting goes to the account, which is
       the one screen that adds up. */
    carry({ barrels: S.barrels - before, title: isBoss ? b.boss.title : null });
    play('victory'); buzz('win');
  } else if (kind === 'loss') { play('defeat'); buzz('lose'); }

  /* The verdict's colour is a class, not an inline hex-by-proxy: the three
     outcomes are the same good / caution / bad the whole game reads in, so
     they are named that way and the stylesheet decides what they look like. */
  const tone = { win: 'good', loss: 'bad', escaped: 'warn' };
  const txt = { win: isBoss ? 'Admiral Broken' : 'Victorious', loss: 'Defeated', escaped: 'Escaped' };

  let inner = `<div class="big ${tone[kind]}">${txt[kind]}</div>`;
  if (kind === 'loss') {
    inner += `<div class="sub">What is still afloat turns for home and the surgeons.</div>`;
  }
  inner += `<button class="btn gold wide bannerok" data-act="battle-continue" data-kind="${kind}">Continue</button>`;

  el.innerHTML = inner;
  el.classList.add('on');
  refreshTut();

  save();
  updateRes();
}

export const bannerOpen = () => $('banner').classList.contains('on');
