/* Cargo contracts.

   Every charted port keeps one open contract: bring X of some good to another
   port, get paid. Contracts persist in the save so the offer does not shuffle
   under the player between renders, and a fresh one is drawn once the last is
   delivered.

   Lives in core rather than systems because selectors need it to enumerate the
   chart, and systems may not be imported from core. */

import { S } from './state.js';
import { CONTRACT_PAY_BASE, CONTRACT_PAY_PER_TIER } from './config.js';
import { PORTS } from '../data/ports.js';
import { GOODS, goodsForTier } from '../data/goods.js';
import { pick } from './rng.js';

/* Route length from the actual distance between the two ports, so a run across
   the Atlantic takes longer than a hop down the coast. */
function legLength(from, to) {
  const dx = from.x - to.x, dy = from.y - to.y;
  return Math.max(1, Math.round(Math.hypot(dx, dy) / 55));
}

function draw(pid) {
  const p = PORTS[pid];
  const good = pick(goodsForTier(p.t));
  const qty = 5 + 2 * p.t + Math.floor(Math.random() * 4);

  /* Deliver somewhere else in charted waters; failing that, back to base. */
  const candidates = Object.keys(PORTS).filter(k =>
    k !== pid && S.unlocked.includes(PORTS[k].region));
  const destId = candidates.length ? pick(candidates) : pid;
  const dest = PORTS[destId];

  const rate = CONTRACT_PAY_BASE + CONTRACT_PAY_PER_TIER * p.t;
  return {
    id: 'k' + pid + '_' + Date.now().toString(36),
    good, qty, destId,
    len: legLength(p, dest),
    danger: Math.min(3, Math.floor((p.t - 1) / 3)),
    /* Busier ports sit on busier water. */
    riseMin: Math.max(10, 30 - p.t),
    dangerCap: Math.min(3, 1 + Math.floor(p.t / 3)),
    rew: { gold: Math.round(qty * GOODS[good].buy * rate) }
  };
}

/* The contract on offer at a port, drawing a new one if there is none. */
export function ensureContract(pid) {
  if (!S.contracts[pid]) S.contracts[pid] = draw(pid);
  return S.contracts[pid];
}

/* Called on delivery — the next look at this port draws something new. */
export function clearContract(pid) {
  delete S.contracts[pid];
}

/* Present a contract as a route the rest of the game can treat like any other. */
export function contractRoute(pid) {
  const c = ensureContract(pid), p = PORTS[pid];
  return {
    id: 'k_' + pid, region: p.region, type: 'cargo', portId: pid, contract: c,
    n: p.n + ' → ' + PORTS[c.destId].n,
    good: c.good, qty: c.qty, dest: PORTS[c.destId].n,
    danger: c.danger, riseMin: c.riseMin, dangerCap: c.dangerCap,
    len: c.len, rew: c.rew,
    x: p.x, y: p.y
  };
}
