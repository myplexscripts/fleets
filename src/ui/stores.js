/* Ship's Stores — what is in the warehouse. Opened by tapping the Goods or
   Materials plate.

   Read-only on purpose: selling has a counter of its own in the Market, and two
   places to sell the same crate is exactly the kind of thing that makes a
   player hunt for the button. */

import { S } from '../core/state.js';
import { actions } from '../core/actions.js';
import { GOODS, GOOD_KEYS } from '../data/goods.js';
import { MATERIALS, MAT_KEYS } from '../data/materials.js';
import { BELL_NAMES, bellMaxDepth } from '../data/salvage.js';
import { totalGoods, totalMats } from '../core/selectors.js';
import { chip, chipRow } from './format.js';
import { itemCard, itemGrid, sect } from './components.js';
import { setSheet, openSheet } from './sheet.js';

export function openStores() {
  drawStores();
  openSheet();
}

const row = (key, def, held) => itemCard({
  icon: key, name: def.n, sub: def.unit,
  held: chipRow([chip(key, held, held ? '' : 'dim', def.n + ' in store')], 'tight'),
  cls: held ? '' : 'dis'
});

function drawStores() {
  setSheet(
    `<div class="row"><h3>Ship's Stores</h3>
       ${chipRow([
         chip('cargo', totalGoods(), 'gold', 'Goods in store'),
         chip('mats', totalMats(), 'gold', 'Materials in store')
       ], 'tight')}</div>
     <div class="sub quote" style="margin-top:6px">Won off the routes you run and the ships you beat. Sell what you cannot place at the Market.</div>`,

    `${sect('Trade Goods', 0)}
     ${itemGrid(GOOD_KEYS.map(k => row(k, GOODS[k], S.goods[k])).join(''))}
     ${sect('Materials', 1)}
     ${itemGrid(MAT_KEYS.map(k => row(k, MATERIALS[k], S.mats[k])).join(''))}
     ${sect('Salvage Gear', 2)}
     ${itemCard({
       icon: 'bell', name: BELL_NAMES[S.bell], sub: 'Diving bell',
       held: chipRow([chip('depth', bellMaxDepth(S.bell), '', 'Reaches')], 'tight')
     })}`,

    `<button class="btn gold wide" data-act="close-sheet">Close</button>`
  );
}

actions({ stores: openStores });
