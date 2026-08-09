/* Who is out there.

   Nothing is hand-placed. A line-up is drawn from the water's rating (see
   data/water.js) and a band around it, so the same lane fields heavier ships
   after it has drifted, in a worse region, or when the navy wants you badly —
   and 1 in 5 encounters is a soft touch while 1 in 4 is more than the water is
   rated for.

   Two rules the draw has to obey:

     It is drawn once. Opening a mission, closing it and opening it again used
     to produce a fresh line-up, which was a reroll wearing a disguise — with a
     band in play it would be a slot machine. Draws are stored against the route
     and only replaced when the fight resolves or the water underneath them
     genuinely changes.

     What you capture is not what you fought. A prize comes home as a stock hull
     of her class: her crew, her guns and her fittings went over the side or to
     the bottom with the people who were using them. That is what keeps the
     flagship the only ship in the fleet that grows. */

import { TYPES } from '../data/ships.js';
import { SHIP_NAMES, FACTIONS } from '../data/names.js';
import { BANDS, LADDER, CHEST_BANDS } from '../data/water.js';
import { DRAW_TTL_MS } from '../core/config.js';
import { S } from '../core/state.js';
import { now } from '../core/dom.js';
import { routeRating, effDanger, heatStep } from '../core/selectors.js';
import { pick } from '../core/rng.js';

/* One ship's contribution, using the same formula the fleet is measured by. */
const shipRating = s => Math.round(s.guns * 2 + s.speed + s.hull / 5);
const stockRating = ty => {
  const b = TYPES[ty];
  return shipRating({ guns: b.guns, speed: b.speed, hull: b.hull });
};

/* Which classes this water fields at all. Always at least the smallest. */
function classesFor(rating) {
  const open = LADDER.filter(l => rating >= l.from);
  return open.length ? open : [LADDER[0]];
}

/* Build one enemy of a class, scaled by `mod`. */
function makeShip(type, mod, name) {
  const b = TYPES[type];
  const hull = Math.max(6, Math.round(b.hull * mod));
  return {
    type, name,
    hull, max: hull,
    guns: Math.max(1, Math.round(b.guns * mod)),
    speed: b.speed,
    disabled: false
  };
}

/* Pick which band this encounter is. */
function rollBand() {
  let r = Math.random();
  for (const b of BANDS) {
    if (r < b.share) return b;
    r -= b.share;
  }
  return BANDS[1];
}

/* Fill a line to roughly `target` total rating.

   Heavier water fields more of them and heavier ones, but the line is never
   uniform — each slot takes the class closest to its share of what is left, so
   a lone Man o' War and three brigs can both come out of the same water. */
function fillLine(target, band) {
  const classes = classesFor(target);
  const heaviest = stockRating(classes[classes.length - 1].type);

  /* Two or three hulls. One big ship or three small ones is the difference
     between a duel and a brawl, and both should happen. */
  const count = target > heaviest * 2.2 ? 3 : (Math.random() < 0.45 ? 3 : 2);

  /* One faction per line. "HMS Bulldog and HMS Valiant" reads as the navy
     coming for you; the same two hulls called "Gallows Wind" and "The Bone
     Collector" read as pirates working the lane. Mixed, they read as neither —
     so the whole line is drawn from one side, and names are taken per class so
     a sloop never ends up called The Hellbound Colossus. */
  const side = pick(FACTIONS);
  const used = new Set();
  const nameFor = ty => {
    const pool = (SHIP_NAMES[ty] || SHIP_NAMES.brig)[side];
    const free = pool.filter(n => !used.has(n));
    const n = pick(free.length ? free : pool);
    used.add(n);
    return n;
  };

  const out = [];
  let left = target;

  for (let i = 0; i < count; i++) {
    const want = left / (count - i);

    let best = classes[0];
    for (const c of classes) {
      if (Math.abs(stockRating(c.type) - want) < Math.abs(stockRating(best.type) - want)) best = c;
    }

    /* Trim the multiplier so a stock hull is never stretched past recognition. */
    const mod = Math.max(0.7, Math.min(1.9, want / Math.max(1, stockRating(best.type))));
    const name = nameFor(best.type);
    const ship = makeShip(best.type, mod, name);
    if (band.key === 'hunter' && i === 0) ship.named = true;
    if (CHEST_BANDS.includes(band.key) && i === 0) ship.chest = true;
    out.push(ship);
    left -= shipRating(ship);
  }
  return out;
}

/* A fresh line-up for a route, at the rating its water carries right now. */
function drawLine(r) {
  const rating = routeRating(r);
  const band = rollBand();
  const target = Math.round(rating * (band.lo + Math.random() * (band.hi - band.lo)));
  const ships = fillLine(Math.max(12, target), band);

  /* Nobody blockades a harbour in a schooner. */
  if (r.type === 'blockade') {
    ships.forEach((sh, i) => {
      if (sh.type === 'schooner') ships[i] = { ...makeShip('brig', 1, sh.name), chest: sh.chest, named: sh.named };
    });
  }

  /* A bounty is a person, so the ship at the head of her line is HER SHIP: the
     chart carries the captain's name, the water carries the hull's. She also
     has the strongbox that is otherwise a one-in-five roll. The rest are
     whoever sails with her. */
  if (r.type === 'bounty' && ships.length) {
    ships[0].name = r.ship || r.n;
    ships[0].named = true;
    ships[0].chest = true;
    ships.slice(1).forEach(s => { s.chest = false; });
  }

  return { band: band.key, label: band.n, rating, ships };
}

/* The stamp a draw is valid for. Change the water and the draw goes stale —
   which is the honest version of a reroll: fight the lane, patrol the region or
   let it drift, and somebody else is working it. */
const stampOf = r => [r.id, effDanger(r), heatStep(r.region)].join('|');

/* What is waiting on this route. Drawn once, then remembered. */
export function genEnemies(r) {
  if (!S.draws) S.draws = {};
  const stamp = stampOf(r);
  const held = S.draws[r.id];

  if (held && held.stamp === stamp && (now() - held.at) < DRAW_TTL_MS) {
    return held.line.ships.map(s => ({ ...s, disabled: false }));
  }

  const line = drawLine(r);
  S.draws[r.id] = { stamp, at: now(), line };
  return line.ships.map(s => ({ ...s, disabled: false }));
}

/* Which band the line currently drawn for this route came out of, so the panel
   can say "Heavy" or "Hunters" before the player commits to anything. */
export function drawBand(r) {
  const held = S.draws && S.draws[r.id];
  return held && held.stamp === stampOf(r) ? held.line : null;
}

/* Forget a draw. Called when a fight resolves — beaten ships do not come back
   as the same beaten ships. */
export function clearDraw(id) {
  if (S.draws) delete S.draws[id];
}

export function bossEnemies(b) {
  return b.ships.map(s => ({ ...s, max: s.hull, disabled: false, pal: 'boss', chest: !s.isBoss }));
}

/* Deliberately trivial — this is the tutorial's first fight. */
export function tutEnemies() {
  return [
    { type: 'schooner', name: 'Smuggler Skiff', hull: 14, max: 14, guns: 2, speed: 6, disabled: false },
    { type: 'schooner', name: 'Cutthroat Jib',  hull: 14, max: 14, guns: 2, speed: 6, disabled: false }
  ];
}

/* A charter is a commission against named opposition, so it is rated off the
   charter's own tier rather than the water it happens to sit in — but it is
   filled by the same machinery, so it reads like every other fight. */
export function charterEnemies(c) {
  return fillLine(Math.max(16, Math.round(14 + c.t * 11)), BANDS[1]);
}
