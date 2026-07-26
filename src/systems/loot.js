/* Battle loot.

   Winning a fight hands back trade goods, which is what closes the economy into
   a loop: clear the water, come home with cargo, run that cargo for gold. A
   captain who fights never has to buy stock at the counter; one who never
   fights always does. */

import { S } from '../core/state.js';
import { REGIONS } from '../data/world.js';
import { GOODS, goodsForTier } from '../data/goods.js';
import { pick, rnd } from '../core/rng.js';

/* Goods taken off a beaten enemy. Richer water carries richer cargo. */
export function goodsHaul(region, danger) {
  const tier = REGIONS[region] ? REGIONS[region].tier : 1;
  const good = pick(goodsForTier(tier * 2 + (danger || 0)));
  const n = Math.max(1, Math.round(rnd(2, 4 + tier + (danger || 0))));
  S.goods[good] += n;
  return { good, n, unit: GOODS[good].unit, name: GOODS[good].n };
}

export const haulLine = h =>
  h ? `${h.n} ${h.unit} of ${h.name.toLowerCase()} came out of their holds.` : '';
