/* Awarding collectible pieces. */

import { S } from '../core/state.js';
import { SETS, PIECE_SET, DROP_POOLS } from '../data/collectibles.js';
import { hasPiece, setComplete } from '../core/selectors.js';
import { pick } from '../core/rng.js';
import { play } from '../fx/sound.js';

/* Add a named piece. Returns a description of what happened, or null if it was
   already on the shelf. */
export function awardPiece(name) {
  const setKey = PIECE_SET[name] || 'loose';
  S.collected[setKey] = S.collected[setKey] || [];
  if (S.collected[setKey].includes(name)) return null;

  S.collected[setKey].push(name);
  const set = SETS[setKey];
  const complete = set && setComplete(setKey);

  /* The award card is raised by whoever asked for the piece — outcomes.js
     and voyages.js both do it — so all that is owed here is the sound. */
  setTimeout(() => play(complete ? 'victory' : 'relic'), 900);

  return {
    name, setKey, complete,
    setName: set ? set.n : 'Oddments',
    have: set ? S.collected[setKey].length : 0,
    of: set ? set.pieces.length : 0
  };
}

/* Draw an unowned piece from a drop pool. Returns null once a pool is exhausted,
   so a completed set stops eating drop rolls. */
export function rollDrop(poolName) {
  const pool = DROP_POOLS[poolName];
  if (!pool) return null;
  const setKey = PIECE_SET[pool[0]];
  const missing = pool.filter(p => !hasPiece(setKey, p));
  if (!missing.length) return null;
  return awardPiece(pick(missing));
}
