/* Enemy line-up generation. */

import { TYPES, ENAMES } from '../data/ships.js';
import { REGIONS } from '../data/world.js';
import { effDanger } from '../core/selectors.js';
import { shuffled } from '../core/rng.js';

function build(comp, mod) {
  const pool = shuffled(ENAMES);
  return comp.map((ty, i) => {
    const b = TYPES[ty];
    return {
      type: ty, name: pool[i] || b.n,
      hull: Math.round(b.hull * mod), max: Math.round(b.hull * mod),
      guns: Math.round(b.guns * mod), speed: b.speed, disabled: false
    };
  });
}

export function bossEnemies(b) {
  return b.ships.map(s => ({ ...s, max: s.hull, disabled: false, pal: 'boss' }));
}

/* Deliberately trivial — this is the tutorial's first fight. */
export function tutEnemies() {
  return [
    { type: 'schooner', name: 'Smuggler Skiff', hull: 14, max: 14, guns: 2, speed: 6, disabled: false },
    { type: 'schooner', name: 'Cutthroat Jib',  hull: 14, max: 14, guns: 2, speed: 6, disabled: false }
  ];
}

export function charterEnemies(c) {
  const t = c.t;
  const comp = t <= 2 ? ['schooner', 'schooner']
             : t <= 4 ? ['schooner', 'brig']
             : t <= 6 ? ['brig', 'brig', 'schooner']
             : t <= 8 ? ['brig', 'frigate', 'brig']
             : ['frigate', 'frigate', 'brig'];
  return build(comp, 1 + t * 0.05);
}

/* Whoever is working this water, drawn from the water itself: the region's tier
   and the lane's danger right now. Nothing is hand-placed, so a lane that has
   drifted brings out heavier ships than the same lane did an hour ago, and the
   same lane in the Atlantic brings out heavier ships than in the Caribbean.

   There is no rerolling this — what it draws is what you face. */
const LADDER = ['schooner', 'brig', 'frigate', 'manowar'];

export function genEnemies(r) {
  const t = REGIONS[r.region] ? REGIONS[r.region].tier : 1;   // 1..4
  const d = Math.max(1, effDanger(r));                        // 1..2
  const weight = t + d;                                       // 2..6

  /* Heavier water fields more of them, and heavier ones. */
  const count = weight >= 5 ? 3 : weight >= 3 ? (Math.random() < 0.55 ? 3 : 2) : 2;
  const base = Math.min(LADDER.length - 1, Math.floor((weight - 1) / 1.6));

  const comp = [];
  for (let i = 0; i < count; i++) {
    /* The line is not uniform: one may be a class up, one a class down. */
    const jitter = Math.random() < 0.25 ? 1 : (Math.random() < 0.3 ? -1 : 0);
    comp.push(LADDER[Math.max(0, Math.min(LADDER.length - 1, base + jitter))]);
  }
  /* Nobody blockades a harbour in a schooner. */
  if (r.type === 'blockade') {
    for (let i = 0; i < comp.length; i++) if (comp[i] === 'schooner') comp[i] = 'brig';
  }
  return build(comp, 1 + (t - 1) * 0.12 + (d - 1) * 0.06);
}
