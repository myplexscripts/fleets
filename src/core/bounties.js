/* Bounties — the fight that will not wait.

   Everything else on the chart is a place. A patrol is always in the same
   water, a hunting ground refills, a wreck sits there until you work it. Which
   is right for a chart, and means the map never asks the player to do anything
   NOW: every marker is a thing that will still be there tomorrow.

   A bounty is a ship, not a place. A named captain works a region for a while
   and then she is gone — and because she is gone whether you fight her or not,
   taking one is a decision made against a clock rather than against a list.

   Three rules make that worth doing rather than merely stressful:

     She is harder than the water. A bounty is drawn well above the rating her
     region carries, so she is a real fight in water you had got comfortable in.
     That is what makes her worth the reward, and what makes leaving her alone a
     legitimate answer.

     She pays for it. Gold well above a raid, materials, and her captain always
     has a strongbox — the prize that is otherwise a one-in-five roll.

     Missing one costs nothing but the chance. There is no penalty, no failure
     state, no message telling you off. Another will come. A timer that punishes
     you for being asleep is a timer that stops the game being restful, and this
     game is meant to be restful.

   Bounties live in the save so the chart does not reshuffle between renders,
   and they are placed on hand-picked stations so two never land on top of each
   other. */

import { S } from './state.js';
import { now } from './dom.js';
import { REGIONS } from '../data/world.js';
import { pick } from './rng.js';
import {
  BOUNTY_LIFE_MS, BOUNTY_GAP_MS, BOUNTY_RATING_MULT, BOUNTY_MAX
} from './config.js';

let seq = 1;

/* Who she is. The name is the whole of the flavour — a bounty has no briefing
   screen, just a name on the chart and a clock under it. */
const CAPTAINS = [
  'Bloody Anne Vance', 'Silas Kerrigan', 'The Widow Marchetti', 'Ezekiel Crow',
  'Mad Tom Rourke', 'Ines de la Vega', 'Barnaby Skeffington', 'The Grey Fox',
  'Hester Wynn', 'One-Eyed Amara', 'Cutlass Jack Doyle', 'Perpetua Vane'
];

/* Where she can be found. Open water, clear of the lanes and the wrecks, so a
   bounty marker never buries something permanent. */
const STATIONS = {
  caribbean: [
    { n: 'The Windward Reach', x: 246, y: 486 },
    { n: 'Mona Passage',       x: 274, y: 430 },
    { n: 'Vieques Sound',      x: 118, y: 496 }
  ],
  gulf: [
    { n: 'The Yucatán Gap',    x: 86,  y: 214 },
    { n: 'Campeche Bank',      x: 148, y: 296 },
    { n: 'Tampico Roads',      x: 20,  y: 196 }
  ],
  atlantic: [
    { n: 'The Horse Latitudes', x: 296, y: 226 },
    { n: 'Corvo Deep',          x: 340, y: 196 },
    { n: 'The Long Swell',      x: 246, y: 262 }
  ],
  grand: [
    { n: 'The Chops',           x: 86,  y: 74 },
    { n: 'Finisterre Approach', x: 128, y: 34 },
    { n: 'The Western Ocean',   x: 20,  y: 108 }
  ]
};

/* How long she has left, in ms. Zero means she has gone. */
export const bountyLeft = b => Math.max(0, (b.endsAt || 0) - now());
export const bountyLive = b => bountyLeft(b) > 0;

/* Fraction of her window still to run — the chart draws this as a ring. */
export function bountyFrac(b) {
  return Math.max(0, Math.min(1, bountyLeft(b) / Math.max(1, b.life || BOUNTY_LIFE_MS)));
}

function makeBounty(rk, spot) {
  const life = BOUNTY_LIFE_MS;
  return {
    id: 'b' + (seq++) + '_' + (now() % 100000),
    region: rk,
    captain: pick(CAPTAINS),
    n: spot.n, x: spot.x, y: spot.y,
    endsAt: now() + life,
    life
  };
}

/* Top the chart back up.

   Idempotent — running it twice changes nothing. Called from allRoutes(), so it
   runs on every render; it must stay cheap and must not shuffle anything that
   is already standing. */
export function ensureBounties() {
  S.bounties = S.bounties || [];
  S.bountyNext = S.bountyNext || {};

  /* Anyone whose window has closed has sailed. Her draw goes with her, so if
     another turns up on the same station she is genuinely somebody else. */
  const gone = S.bounties.filter(b => !bountyLive(b));
  if (gone.length) {
    gone.forEach(b => { if (S.draws) delete S.draws['bt_' + b.id]; });
    S.bounties = S.bounties.filter(bountyLive);
  }

  (S.unlocked || ['caribbean']).forEach(rk => {
    if (!REGIONS[rk] || !STATIONS[rk]) return;
    if (S.bounties.filter(b => b.region === rk).length >= BOUNTY_MAX) return;
    /* A gap between one leaving and the next arriving, so a region is not
       permanently carrying a bounty — the point of the marker is that seeing
       one is an event. */
    if ((S.bountyNext[rk] || 0) > now()) return;

    const taken = new Set(S.bounties.map(b => b.n));
    const free = STATIONS[rk].filter(s => !taken.has(s.n));
    if (!free.length) return;

    S.bounties.push(makeBounty(rk, pick(free)));
    S.bountyNext[rk] = now() + BOUNTY_LIFE_MS + BOUNTY_GAP_MS;
  });
}

/* She is taken. Off the chart, and the region waits before offering another. */
export function clearBounty(id) {
  const b = (S.bounties || []).find(x => 'bt_' + x.id === id || x.id === id);
  if (!b) return;
  if (S.draws) delete S.draws['bt_' + b.id];
  S.bounties = (S.bounties || []).filter(x => x !== b);
  S.bountyNext = S.bountyNext || {};
  S.bountyNext[b.region] = now() + BOUNTY_GAP_MS;
}

/* Present her as a route the rest of the game can treat like any other.

   `ratingMult` is the whole of what makes her hard: enemies.js multiplies the
   water's rating by it before drawing the band, so she is above what her region
   normally fields no matter which band she rolls. */
export function bountyRoute(b) {
  return {
    id: 'bt_' + b.id,
    region: b.region, type: 'bounty',
    n: b.captain, station: b.n,
    bountyId: b.id, endsAt: b.endsAt, life: b.life,
    ratingMult: BOUNTY_RATING_MULT,
    /* Bounties are not lanes — nothing drifts here and a patrol does not calm
       her. She is as dangerous as she is. */
    danger: 2, dangerCap: 2,
    len: 1, x: b.x, y: b.y,
    rew: {}
  };
}

export const bountyById = id => (S.bounties || []).find(b => 'bt_' + b.id === id);
export const liveBounties = () => (S.bounties || []).filter(bountyLive);
