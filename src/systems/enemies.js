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

export function genEnemies(r) {
  const t = REGIONS[r.region].tier;
  const d = Math.max(1, effDanger(r));
  let comp;
  if (d === 1) {
    comp = t >= 3 ? ['brig', 'brig'] : ['schooner', Math.random() < 0.5 ? 'schooner' : 'brig'];
  } else if (d === 2) {
    comp = t >= 3 ? ['brig', 'frigate', 'brig'] : ['brig', 'brig', Math.random() < 0.4 ? 'frigate' : 'schooner'];
  } else {
    comp = t >= 4 ? ['frigate', 'manowar', 'frigate']
         : (t >= 3 ? ['frigate', 'frigate', 'brig'] : ['brig', 'frigate', 'brig']);
  }
  if (r.type === 'blockade') comp = comp.map(x => (x === 'schooner' ? 'brig' : x));
  return build(comp, 1 + (t - 1) * 0.12);
}
