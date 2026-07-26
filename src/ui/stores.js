/* Ship's Stores — everything in the warehouse, and the option to dump goods on
   the market at a loss. Opened by tapping the Goods or Stores plate. */

import { esc } from '../core/dom.js';
import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { render } from '../core/bus.js';
import { GOODS, GOOD_KEYS } from '../data/goods.js';
import { MATERIALS, MAT_KEYS } from '../data/materials.js';
import { BELL_NAMES, bellMaxDepth } from '../data/salvage.js';
import { totalGoods, totalMats } from '../core/selectors.js';
import { iconHTML } from '../art/icons.js';
import { chip, chipRow } from './format.js';
import { setSheet, openSheet, sheetOpen } from './sheet.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { updateRes } from './hud.js';

export function openStores() {
  drawStores();
  openSheet();
}

function drawStores() {
  const goodsRows = GOOD_KEYS.map(k => {
    const g = GOODS[k], held = S.goods[k];
    return `<div class="storerow ${held ? '' : 'empty'}">
      <span class="sname">${iconHTML(k, 26)}<b>${g.n}</b>${chipRow([chip(k, held, '', 'In store')], 'tight')}</span>
      <span class="sright">
        ${chipRow([chip('gold', g.sell, 'dim', 'Sells for, each')], 'tight')}
        <button class="btn sm" ${held ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="1">Sell 1</button>
        <button class="btn sm" ${held ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="all">All</button>
      </span></div>`;
  }).join('');

  const matRows = MAT_KEYS.map(k => {
    const m = MATERIALS[k];
    return `<div class="storerow ${S.mats[k] ? '' : 'empty'}">
      <span class="sname">${iconHTML(k, 26)}<b>${m.n}</b>${chipRow([chip(k, S.mats[k], '', 'In store')], 'tight')}</span>
      </div>`;
  }).join('');

  setSheet(
    `<div class="row"><h3>Ship's Stores</h3>
       ${chipRow([
         chip('cargo', totalGoods(), 'gold', 'Goods in store'),
         chip('mats', totalMats(), 'gold', 'Materials in store')
       ], 'tight')}</div>
     <div class="sub quote" style="margin-top:6px">A delivery pays several times what this counter will.</div>`,
    `<div class="sect" style="--i:0">Trade Goods</div>
     <div class="storelist">${goodsRows}</div>
     <div class="sect" style="--i:1">Materials</div>
     <div class="storelist">${matRows}</div>
     <div class="sect" style="--i:2">Salvage Gear</div>
     <div class="card" style="--i:3"><div class="row">
       <h3>${iconHTML('bell', 26)} ${esc(BELL_NAMES[S.bell])}</h3>
       ${chipRow([chip('depth', bellMaxDepth(S.bell), '', 'Reaches')], 'tight')}
     </div></div>
     <button class="btn gold wide" style="margin-top:12px" data-act="close-sheet">Close</button>`
  );
}

function sellGood(key, n) {
  const g = GOODS[key];
  const have = S.goods[key];
  const qty = n === 'all' ? have : Math.min(have, +n);
  if (qty <= 0) return;
  S.goods[key] -= qty;
  const paid = qty * g.sell;
  S.gold += paid;
  play('coin');
  toast(`Sold ${qty} ${g.unit} of ${g.n.toLowerCase()} for ${paid} gold.`, 'gold');
  updateRes();
  if (sheetOpen()) drawStores();   // the Market sells too, with no sheet open
  render();
}

actions({
  stores: openStores,
  'sell-good': d => sellGood(d.good, d.n)
});
