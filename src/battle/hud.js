/* Battle chrome: the title line, the running log, order buttons, end banner. */

import { $ } from '../core/dom.js';
import { S, save } from '../core/state.js';
import { iconHTML } from '../art/icons.js';
import { updateRes } from '../ui/hud.js';
import { refreshTut } from '../ui/tutorial.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';
import { BT } from './state.js';

/* Order buttons, in display order. `hot` is the keyboard shortcut. */
export const ORDERS = [
  { id: 'focus',   label: 'Focus Fire',   hot: '1' },
  { id: 'volley',  label: 'Spread Fire',  hot: '2' },
  { id: 'barrels', label: 'Fire Barrels', hot: '3', needsBarrel: true },
  { id: 'brace',   label: 'Brace',        hot: '4' },
  { id: 'board',   label: 'Board',        hot: '5' },
  { id: 'retreat', label: 'Retreat',      hot: '6', cls: 'red' }
];

/* Log lines: newest last, two at a time. The log floats over the water, so
   every line it keeps is a line of the battle it covers up. */
export function blog(m, c) {
  BT.b.log.push({ m, c });
  if (BT.b.log.length > 2) BT.b.log.shift();
  $('blog').innerHTML = BT.b.log.map(l => `<div class="${l.c || ''}">${l.m}</div>`).join('');
}

export function drawHud() {
  $('bTitle').textContent = (BT.b.boss ? BT.b.boss.n + ' — ' : 'Broadsides — ') + 'Round ' + BT.b.round;
  $('bHint').innerHTML = BT.b.telegraph
    ? `<span class="warn">${BT.b.boss.n} is running out her lower deck — BRACE</span>`
    : 'Tap an enemy, then give one order';

  $('bcmds').innerHTML = ORDERS.map(o => {
    const dis = o.needsBarrel && !S.barrels;
    const label = o.id === 'barrels' ? `${o.label} (${S.barrels})` : o.label;
    return `<button class="btn sm ${o.cls || ''}" ${dis ? 'disabled' : ''} data-act="order" data-order="${o.id}">
      <span class="hot">${o.hot}</span>${label}</button>`;
  }).join('');

  refreshTut();
}

export function lockOrders(on) {
  BT.busy = on;
  $('bcmds').classList.toggle('busy', on);
}

export function showBanner(kind) {
  const b = BT.b, el = $('banner');
  const win = kind === 'win', isBoss = !!b.boss;
  refreshTut();

  if (win) { S.barrels = Math.min(9, S.barrels + 1); play('victory'); buzz('win'); }
  else if (kind === 'loss') { play('defeat'); buzz('lose'); }

  const cols = { win: 'var(--grn)', loss: 'var(--red)', escaped: 'var(--yel)' };
  const txt = { win: isBoss ? 'Admiral Broken' : 'Victorious', loss: 'Defeated', escaped: 'Escaped' };

  let inner = `<div class="big" style="color:${cols[kind]}">${txt[kind]}</div>`;
  if (win) {
    const prizes = b.enemies.filter(e => e.disabled && !e.isBoss).length;
    inner += `<div class="rewrow">
        <span>${iconHTML('barrels', 40)} +1 barrel</span>
        <span>${iconHTML('anchor', 40)} ${prizes} prize${prizes !== 1 ? 's' : ''}</span>
        ${isBoss ? `<span>${iconHTML('star', 40)} ${b.boss.title}</span>` : ''}</div>
      <div class="stat"><div class="lbl"><span>lane status</span><span style="color:var(--grn)">securing</span></div>
      <div class="dbar"><i id="secbarFx" style="width:100%;background:var(--red)"></i></div></div>`;
  } else if (kind === 'loss') {
    inner += `<div class="sub" style="margin-top:10px">What is still afloat turns for home and the surgeons.</div>`;
  }
  inner += `<button class="btn gold" style="margin-top:22px;min-width:180px" data-act="battle-continue" data-kind="${kind}">Continue</button>`;

  el.innerHTML = inner;
  el.classList.add('on');
  refreshTut();

  /* Let the security bar animate from red to green after a beat. */
  if (win) setTimeout(() => {
    const s = $('secbarFx');
    if (s) { s.style.width = '28%'; s.style.background = 'var(--grn)'; }
  }, 120);

  save();
  updateRes();
}

export const bannerOpen = () => $('banner').classList.contains('on');
