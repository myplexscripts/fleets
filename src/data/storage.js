/* The warehouse.

   Everything you bring home has to go somewhere. Before this, a hold of spice
   and two hundred tons of ship's timber lived in the same place — nowhere — and
   the only limit on either was how long you could be bothered to play. A cap
   gives the trade half of the game a shape: what to keep, what to sell, and
   when a bigger warehouse is worth more than a bigger gun deck.

   ---- how it cannot lock you out ----

   A cap is the easiest thing in a game to build a dead end out of, so three
   rules hold it open. They are not conventions; check-storage.js enforces all
   three, because every one of them is the kind of thing a later tuning pass
   would quietly break.

     1. The cap is PER KIND, not a shared total. Being full of sugar can never
        stop you earning wood. A single shared warehouse is exactly the trap
        where a hold of worthless goods locks you out of the materials you need
        to buy anything — including a bigger warehouse.

     2. Overflow is SOLD, not lost. Anything over the cap goes on the quay at
        half what the market would pay: you are worse off than if you had had
        the room, and never worse off than if you had not gone. There is no
        state in which earning something makes you poorer, and no reason to
        avoid a reward because you cannot carry it.

     3. An upgrade never costs more of a material than the cap can hold. This is
        the one that actually bites: a warehouse costing 60 metal when you can
        only hold 40 is a wall you cannot climb no matter how long you play. The
        costs below are checked against the cap they are being paid at.

   A fourth follows from the numbers rather than the rules: the largest cargo
   contract in the game asks for 70 units, so a warehouse that reaches 320 can
   always hold one. The starting 40 covers the early contracts, and the ones
   that ask for more arrive with regions you cannot reach yet anyway. */

export const WAREHOUSE = [
  { n: 'Lean-To',         cap: 40,  sub: 'A roof and a lock' },
  { n: 'Storehouse',      cap: 70,  sub: 'Racked and counted' },
  { n: 'Bonded Warehouse', cap: 120, sub: 'Nobody asks questions' },
  { n: 'The Long Cellar', cap: 200, sub: 'Cut into the rock' },
  { n: 'Harbour Vaults',  cap: 320, sub: 'A wing of the quay is yours' }
];

export const MAX_WAREHOUSE = WAREHOUSE.length - 1;

/* Capacity of EACH material and EACH good at this level. */
export const storeCapAt = lvl =>
  WAREHOUSE[Math.max(0, Math.min(MAX_WAREHOUSE, lvl | 0))].cap;

/* The name for use in a sentence, with any article of its own stripped so the
   sentence can supply its own. "The Long Cellar" written into "The ___ would
   not take it" reads "The the long cellar"; lowercasing the lot to dodge that
   turns every other one into a common noun. The names are buildings, so they
   keep their capitals and give up their "The". */
export const storeName = lvl =>
  WAREHOUSE[Math.max(0, Math.min(MAX_WAREHOUSE, lvl | 0))].n.replace(/^The\s+/, '');

/* What the next one costs. Compounds like the flagship tracks, and every
   material figure stays under the cap you are paying it from — see rule 3. */
export function warehouseCost(lvl) {
  const l = Math.max(0, lvl | 0);
  const c = {
    gold: Math.round(900 * Math.pow(2.35, l)),
    wood: Math.round(18 * Math.pow(1.85, l)),
    metal: Math.round(12 * Math.pow(1.95, l))
  };
  /* Cloth only from the second upgrade — the first one is a shed, and asking
     for canvas to build a shed reads as the game inventing a cost. */
  if (l >= 1) c.cloth = Math.round(16 * Math.pow(1.85, l - 1));
  return c;
}

/* Overflow goes on the quay at this fraction of the market price. Low enough
   that room is worth paying for, never zero — see rule 2. */
export const OVERFLOW_RATE = 0.5;
