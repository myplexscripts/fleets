/* Notoriety: the regional bar that summons an admiral once it fills. */

import { S } from '../core/state.js';
import { BOSSES } from '../data/bosses.js';
import { notoGain } from '../core/selectors.js';
import { award } from '../fx/award.js';

/* Returns how much was actually added, so the result card can report it. */
export function addNoto(route, forced) {
  const rk = route.region, b = BOSSES[rk];
  if (!b || S.bossBeaten[rk]) return 0;

  const before = S.noto[rk] || 0;
  if (before >= b.noto) return 0;

  const gain = forced || notoGain(route);
  S.noto[rk] = Math.min(b.noto, before + gain);

  if (S.noto[rk] >= b.noto) {
    setTimeout(() => award({
      icon: 'danger', kind: 'Admiral Provoked', title: b.n,
      text: 'She is on the chart. Go and fight her.',
      ok: 'To the Chart', sound: 'boss_horn'
    }), 900);
  }
  return gain;
}
