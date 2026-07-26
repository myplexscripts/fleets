/* Notoriety: the regional bar that summons an admiral once it fills. */

import { S } from '../core/state.js';
import { BOSSES } from '../data/bosses.js';
import { notoGain } from '../core/selectors.js';
import { toast } from '../fx/toast.js';
import { play } from '../fx/sound.js';
import { buzz } from '../fx/haptics.js';

/* Returns how much was actually added, so the result card can report it. */
export function addNoto(route, forced) {
  const rk = route.region, b = BOSSES[rk];
  if (!b || S.bossBeaten[rk]) return 0;

  const before = S.noto[rk] || 0;
  if (before >= b.noto) return 0;

  const gain = forced || notoGain(route);
  S.noto[rk] = Math.min(b.noto, before + gain);

  if (S.noto[rk] >= b.noto) {
    setTimeout(() => {
      play('boss_horn');
      buzz('warn');
      toast(b.n + ' has been provoked. The admiral is on the map — go and fight.', 'bad');
    }, 900);
  }
  return gain;
}
