/* Wanted level.

   How badly the navy wants you, per region. It does two jobs, and it is the
   same number doing both:

     Below the threshold it makes the water worse — the more badly you are
     wanted somewhere, the heavier the ships that come looking for you there.
     That is what keeps a region interesting after you have out-sailed it.

     At the threshold, that region's admiral comes out. She is summoned once and
     stays summoned: heat cools on its own, but an admiral you earned is not
     something you can lose by taking too long over her.

   It is not a resource and it is not spent. It is a temperature. */

import { S } from '../core/state.js';
import { BOSSES } from '../data/bosses.js';
import { notoGain, addWanted, wantedOf } from '../core/selectors.js';
import { award } from '../fx/award.js';

/* Returns how much heat was actually added, so the report can show it. */
export function addNoto(route, forced) {
  const rk = route.region, b = BOSSES[rk];
  if (!b || S.bossBeaten[rk]) return 0;
  if (S.summoned[rk]) return 0;              // she is already out; nothing to raise

  const before = wantedOf(rk);
  const gain = forced || notoGain(route);
  const after = addWanted(rk, gain);

  if (after >= b.noto) {
    S.summoned[rk] = 1;
    setTimeout(() => award({
      icon: 'danger', kind: 'Admiral Provoked', title: b.n,
      text: 'She is on the chart, and she is not leaving. Go and fight her.',
      ok: 'Continue', sound: 'boss_horn'
    }), 900);
  }
  return Math.round(after - before);
}
