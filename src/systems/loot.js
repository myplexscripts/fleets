/* Battle loot.

   Winning a fight hands back trade goods, which is what closes the economy into
   a loop: clear the water, come home with cargo, run that cargo for gold. A
   captain who fights never has to buy stock at the counter; one who never
   fights always does. */

import { S } from '../core/state.js';
import { REGIONS } from '../data/world.js';
import { GOODS, goodsForTier } from '../data/goods.js';
import { MAT_KEYS } from '../data/materials.js';
import { pick, rnd } from '../core/rng.js';

/* Goods taken off a beaten enemy. Richer water carries richer cargo. */
export function goodsHaul(region, danger) {
  const tier = REGIONS[region] ? REGIONS[region].tier : 1;
  const good = pick(goodsForTier(tier * 2 + (danger || 0)));
  /* Scaled with the water, because the deep-sea contracts ask for sixty crates
     and nothing else in the game hands out trade goods. */
  const n = Math.max(2, Math.round(rnd(2 + tier, 4 + tier * 2.6 + (danger || 0) * 1.5)));
  S.goods[good] += n;
  return { good, n, unit: GOODS[good].unit, name: GOODS[good].n };
}

export const haulLine = h =>
  h ? `${h.n} ${h.unit} of ${h.name.toLowerCase()} came out of their holds.` : '';

/* The return cargo. A delivered ship does not sail home empty — she is paid in
   coin and loaded with whatever that port had going the other way, which is
   never what she just dropped off. This is what keeps trade self-sustaining now
   that no counter sells goods: run a contract, come home able to run another. */
export function returnCargo(region, delivered, qty) {
  const tier = REGIONS[region] ? REGIONS[region].tier : 1;
  const choices = goodsForTier(tier * 2).filter(g => g !== delivered);
  if (!choices.length) return null;
  const good = pick(choices);
  const n = Math.max(2, Math.round(qty * rnd(0.4, 0.75)));
  S.goods[good] += n;
  return { good, n, unit: GOODS[good].unit, name: GOODS[good].n };
}

/* Timber, ingots and canvas stripped off a beaten hull. Every win yields some,
   so a captain who has run out of gold can always fight their way back to a
   refit instead of being stuck. */
export function matsHaul(region, danger) {
  const tier = REGIONS[region] ? REGIONS[region].tier : 1;
  const total = Math.max(2, Math.round(rnd(2, 4 + tier * 1.6 + (danger || 0) * 1.2)));
  const out = {};
  for (let i = 0; i < total; i++) {
    const m = pick(MAT_KEYS);
    out[m] = (out[m] || 0) + 1;
  }
  MAT_KEYS.forEach(m => { if (out[m]) S.mats[m] += out[m]; });
  return out;
}
