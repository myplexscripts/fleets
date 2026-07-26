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
    const g = GOODS[k], have = S.goods[k];
    return `<div class="storerow ${have ? '' : 'empty'}">
      <span class="sname">${iconHTML(k, 26)}<b>${g.n}</b><i>${have} ${g.unit}</i></span>
      <span class="sright">
        <span class="sub">${g.sell}${iconHTML('gold', 16)} ea</span>
        <button class="btn sm" ${have ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="1">Sell 1</button>
        <button class="btn sm" ${have ? '' : 'disabled'} data-act="sell-good" data-good="${k}" data-n="all">All</button>
      </span></div>`;
  }).join('');

  const matRows = MAT_KEYS.map(k => {
    const m = MATERIALS[k];
    return `<div class="storerow ${S.mats[k] ? '' : 'empty'}">
      <span class="sname">${iconHTML(k, 26)}<b>${m.n}</b><i>${S.mats[k]} ${m.unit}</i></span>
      </div>`;
  }).join('');

  setSheet(
    `<div class="row"><h3>Ship's Stores</h3>
       <span class="tag gold">${totalGoods()} GOODS · ${totalMats()} MATERIALS</span></div>
     <div class="sub quote" style="margin-top:6px">Goods are for contracts — a delivery pays several times what the market will give you for the same crates. Sell only what you cannot place.</div>`,
    `<div class="sect" style="--i:0">Trade Goods</div>
     <div class="storelist">${goodsRows}</div>
     <div class="sect" style="--i:1">Materials</div>
     <div class="sub" style="margin-bottom:8px">Spent on refits and the diving bell. Won by fighting, breaking up hulls, and diving — never handed over as contract pay.</div>
     <div class="storelist">${matRows}</div>
     <div class="sect" style="--i:2">Salvage Gear</div>
     <div class="card" style="--i:3"><div class="row">
       <div style="flex:1"><h3>${iconHTML('bell', 26)} ${esc(BELL_NAMES[S.bell])}</h3>
         <div class="sub">Reaches depth ${bellMaxDepth(S.bell)}. Upgrade it in the Market to work deeper wrecks.</div></div>
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
