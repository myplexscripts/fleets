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
import { WAREHOUSE, MAX_WAREHOUSE } from '../data/storage.js';
import { totalGoods, totalMats, storeCap } from '../core/selectors.js';
import { chip, chipRow, outOf } from './format.js';
import { iconHTML } from '../art/icons.js';
import { itemCard, itemGrid, sect } from './components.js';
import { setSheet, openSheet } from './sheet.js';

export function openStores() {
  drawStores();
  openSheet();
}

/* held/cap, not a bare count. What matters about a pile of sugar once there is
   a warehouse is not how much of it there is but how close it is to the line —
   and the line is per kind, so being full of one thing says nothing about the
   room left for anything else. */
const row = (key, def, held) => {
  const cap = storeCap(), full = held >= cap;
  return itemCard({
    icon: key, name: def.n, sub: def.unit,
    held: chipRow([outOf(key, held, cap, full ? 'warn' : (held ? '' : 'dim'),
      def.n + ' in store, of the room there is')], 'tight'),
    body: held ? `<div class="bar"><i style="width:${Math.min(100, held / cap * 100)}%"
      ${full ? 'class="crit"' : (held > cap * 0.8 ? 'class="low"' : '')}></i></div>` : '',
    cls: held ? (full ? 'owned' : '') : 'dis'
  });
};

function drawStores() {
  setSheet(
    `<h3>${iconHTML('anchor', 0, 'plaqic')}<span>Ship's Stores</span>${iconHTML('anchor', 0, 'plaqic')}</h3>
     <div class="sheet-sub">${WAREHOUSE[S.wh].n}</div>
     <div class="row" style="margin-top:9px">${chipRow([
       chip('cargo', totalGoods(), 'gold', 'Goods in store'),
       chip('mats', totalMats(), 'gold', 'Materials in store')
     ], 'tight')}</div>`,

    `<div class="sub quote">Won off the routes you run and the ships you beat. Sell what you cannot place at the Market.</div>
     ${sect('Trade Goods', 0)}
     ${itemGrid(GOOD_KEYS.map(k => row(k, GOODS[k], S.goods[k])).join(''), 'rail')}
     ${sect('Materials', 1)}
     ${itemGrid(MAT_KEYS.map(k => row(k, MATERIALS[k], S.mats[k])).join(''), 'rail')}
     ${sect('Storage', 2)}
     ${itemCard({
       icon: 'cargo', name: WAREHOUSE[S.wh].n, sub: WAREHOUSE[S.wh].sub,
       held: chipRow([chip('cargo', storeCap(), '', 'Room for this much of every kind')], 'tight'),
       body: '<div class="sub">Anything over the line is sold on the quay at half price. '
         + (S.wh < MAX_WAREHOUSE ? 'A bigger one is for sale at the Market.' : 'There is nothing bigger.')
         + '</div>'
     })}
     ${sect('Salvage Gear', 3)}
     ${itemCard({
       icon: 'bell', name: BELL_NAMES[S.bell], sub: 'Diving bell',
       held: chipRow([chip('depth', bellMaxDepth(S.bell), '', 'Reaches')], 'tight')
     })}`,

    `<button class="btn gold wide" data-act="close-sheet">Close</button>`
  );
}

actions({ stores: openStores });
