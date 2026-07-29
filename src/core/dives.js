/* Wreck sites.

   A wreck is a place, and a place you have already stripped is not worth going
   back to. So dive sites are not fixed nodes on the chart — they are a live set
   that answers to two things:

     The bell you own. Every site sits at a depth, and a site you cannot reach
     is a site nobody would chart. Buying a deeper bell does not just unlock an
     existing marker, it puts new wrecks on the map at the depth you can now
     work. That is what makes the upgrade feel like it opened something.

     Whether you have worked it. Finish a dive and that wreck is gone — she has
     been emptied. Another site turns up somewhere else in the region, because
     the sea is large and this coast has been swallowing ships for two hundred
     years.

   Sites are stored in the save so the chart does not shuffle under the player
   between renders, and they are placed on hand-picked anchorages rather than at
   random coordinates so the map still looks drawn rather than generated. */

import { S } from './state.js';
import { REGIONS } from '../data/world.js';
import { bellMaxDepth, CHEST_VALUE, MAX_BELL } from '../data/salvage.js';

/* The deepest water there is — one past the best bell. */
const MAX_DEPTH = bellMaxDepth(MAX_BELL);
import { pick, rnd } from './rng.js';

/* How many workable wrecks a region keeps charted. Enough that there is always
   somewhere to dive, few enough that the chart is not a field of rings. */
export const SITES_PER_REGION = 2;

/* Plus one site a single step deeper than the bell can currently reach.

   It is charted, it is named, and it cannot be worked — and that is the entire
   reason to buy a better bell. Without it, deeper water simply would not exist
   until the moment you paid for it, and an upgrade you cannot see the point of
   in advance is an upgrade nobody buys. One is enough; a wall of locked rings
   would just read as a paywall. */
export const TEASE_BEYOND = 1;

/* Where a wreck can be. Real spots on the chart, so two sites never land on top
   of each other and the map keeps its hand-drawn feel. */
const ANCHORAGES = {
  caribbean: [
    { n: 'Wreck of the Santa Ana',  x: 132, y: 440 },
    { n: 'The Tortuga Shallows',    x: 100, y: 402 },
    { n: 'Cayman Reef',             x: 158, y: 470 },
    { n: 'The Serpent Bar',         x: 208, y: 470 }
  ],
  gulf: [
    { n: 'Graveyard Shoals',        x: 28,  y: 262 },
    { n: 'The Pelican Bank',        x: 78,  y: 288 },
    { n: 'Wreck of the Concepción', x: 120, y: 244 },
    { n: 'Barataria Deep',          x: 56,  y: 322 }
  ],
  atlantic: [
    { n: 'Bermuda Deeps',           x: 308, y: 296 },
    { n: 'The Azores Trench',       x: 350, y: 268 },
    { n: 'Sargasso Hollow',         x: 272, y: 320 },
    { n: 'The Drowned Fleet',       x: 336, y: 156 }
  ],
  grand: [
    { n: 'The Abyssal Shelf',       x: 268, y: 78 },
    { n: 'Finisterre Deep',         x: 300, y: 140 },
    { n: 'The Black Trench',        x: 88,  y: 34 },
    { n: 'Wreck of the Invincible', x: 172, y: 62 }
  ]
};

/* What a wreck at this depth is worth bringing up. */
function siteAt(region, depth, spot, seq) {
  return {
    id: 'dv' + seq,
    region, depth,
    n: spot.n, x: spot.x, y: spot.y,
    chestMin: 2 + Math.floor(depth / 2),
    chestMax: 4 + depth,
    len: Math.max(1, depth),
    rew: {
      metal: 2 + depth * 3,
      wood: 1 + depth * 2,
      cloth: depth >= 3 ? depth * 2 : 0,
      gold: depth >= 4 ? (depth - 3) * 200 : 0
    }
  };
}

let seq = 1;

/* Depths worth charting right now: everything the bell reaches, deepest first,
   so an upgrade always puts something genuinely new on the map. */
function depthsFor() {
  const max = bellMaxDepth(S.bell);
  const out = [];
  for (let d = max; d >= 1; d--) out.push(d);
  return out;
}

/* Top the chart back up. Called on load, after a dive, and after a bell
   upgrade. Idempotent — running it twice changes nothing. */
export function ensureDives() {
  S.dives = S.dives || [];
  S.dives.forEach(d => {
    const n = parseInt(String(d.id).replace(/\D/g, ''), 10);
    if (n >= seq) seq = n + 1;
  });

  const depths = depthsFor();
  const reach = bellMaxDepth(S.bell);

  (S.unlocked || ['caribbean']).forEach(rk => {
    if (!REGIONS[rk] || !ANCHORAGES[rk]) return;
    const mine = S.dives.filter(d => d.region === rk);
    /* The locked teaser does not count against the workable quota — otherwise
       buying a bell would swap a site out rather than opening one up. */
    const workable = mine.filter(d => d.depth <= reach).length;
    const need = SITES_PER_REGION - workable;
    if (need <= 0 && mine.some(d => d.depth > reach)) return;

    const taken = new Set(mine.map(d => d.n));
    const recent = new Set(((S.diveUsed || {})[rk]) || []);
    /* Prefer somewhere that is neither charted nor freshly stripped; fall back
       to merely uncharted if this coast has run out of anywhere else. */
    let free = ANCHORAGES[rk].filter(a => !taken.has(a.n) && !recent.has(a.n));
    if (!free.length) free = ANCHORAGES[rk].filter(a => !taken.has(a.n));

    /* One site at the deepest water the bell reaches, so the newest thing the
       player bought always has somewhere to be used. The rest spread shallower. */
    for (let i = 0; i < need && free.length; i++) {
      const spot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      const depth = i === 0 ? depths[0] : pick(depths);
      S.dives.push(siteAt(rk, depth, spot, seq++));
    }

    /* And the one you can see but cannot work yet. */
    const beyond = reach + TEASE_BEYOND;
    const hasTease = S.dives.some(d => d.region === rk && d.depth > reach);
    if (!hasTease && beyond <= MAX_DEPTH && free.length) {
      const spot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      S.dives.push(siteAt(rk, beyond, spot, seq++));
    }
  });
}

/* The bell got deeper. Any site the player has not touched that sits well
   inside the old range is replaced, so an upgrade visibly changes the chart
   rather than quietly widening a range nobody can see. */
export function rechartDives() {
  S.dives = S.dives || [];
  const max = bellMaxDepth(S.bell);
  /* Anything now well inside the bell's range is stale — the point of the
     upgrade is that the chart changes. The teaser that just came into reach
     stays exactly where it is: that wreck is the thing you bought the bell
     for, and taking it away at the moment of purchase would be perverse. */
  const dropped = S.dives.filter(d => d.depth < max - 1);
  S.dives = S.dives.filter(d => d.depth >= max - 1);

  /* Hold the spots we just uncharted back, so the same named wreck does not
     reappear at a new depth. A wreck sits where she sank; if the Santa Ana was
     in the shallows last week she is not in the trench today. */
  S.diveUsed = S.diveUsed || {};
  dropped.forEach(d => {
    const seen = S.diveUsed[d.region] = S.diveUsed[d.region] || [];
    seen.unshift(d.n);
    seen.length = Math.min(seen.length, 2);
  });

  ensureDives();
}

/* This wreck has been emptied.

   The spot is remembered for a little while so the coast does not immediately
   re-chart the same wreck you just finished stripping — "removed from the map"
   has to mean removed, not blinked. Two spots per region are held back, and
   there are four to choose from, so there is always somewhere left to put one. */
export function clearDive(id) {
  const gone = (S.dives || []).find(d => d.id === id);
  if (gone) {
    S.diveUsed = S.diveUsed || {};
    const seen = S.diveUsed[gone.region] = S.diveUsed[gone.region] || [];
    seen.unshift(gone.n);
    seen.length = Math.min(seen.length, 2);
  }
  S.dives = (S.dives || []).filter(d => d.id !== id);
  ensureDives();
}

/* Present a site as a route the rest of the game can treat like any other. */
export function diveRoute(d) {
  return {
    id: 'dv_' + d.id, region: d.region, type: 'dive', diveId: d.id,
    n: d.n, depth: d.depth,
    chestMin: d.chestMin, chestMax: d.chestMax, len: d.len,
    rew: d.rew, danger: 0, x: d.x, y: d.y
  };
}

export const diveById = id => (S.dives || []).find(d => 'dv_' + d.id === id);
export const chestGold = depth => CHEST_VALUE[depth] || 0;
export const siteCount = () => (S.dives || []).length;
export const jitter = () => rnd(0, 1);
