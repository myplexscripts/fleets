/* Trade goods.

   Goods exist to be delivered. A cargo contract names a good, a quantity and a
   port, and pays well for it. Selling at the market is always available and
   always worse — it is the release valve for stock you cannot place, not a
   business model. */

/* `buy` and `sell` are gold per unit. */
export const GOODS = {
  sugar:   { n: 'Sugar',   unit: 'crates',  buy: 10, sell: 6 },
  rum:     { n: 'Rum',     unit: 'barrels', buy: 16, sell: 10 },
  tobacco: { n: 'Tobacco', unit: 'bales',   buy: 24, sell: 15 },
  wine:    { n: 'Wine',    unit: 'casks',   buy: 34, sell: 21 },
  spice:   { n: 'Spice',   unit: 'chests',  buy: 48, sell: 30 }
};

export const GOOD_KEYS = Object.keys(GOODS);

/* Which goods a port of tier `t` asks for. Cheap staples early, luxuries in the
   deep-water ports, so contracts get richer as the chart opens up. */
export function goodsForTier(t) {
  if (t <= 2) return ['sugar', 'rum'];
  if (t <= 4) return ['sugar', 'rum', 'tobacco'];
  if (t <= 6) return ['rum', 'tobacco', 'wine'];
  if (t <= 8) return ['tobacco', 'wine', 'spice'];
  return ['wine', 'spice'];
}
