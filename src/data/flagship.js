/* The flagship: base stats, upgrade tracks, fittings, and charter boons. */

/* She starts as the best ship you own and ends as the best ship in the game.

   That is the whole reason she exists. Every other hull in your fleet is a
   fixed stat block you took off somebody — a captured Man o' War is power 44
   forever, because what you took was a hull and her guns and her people went
   down with the ones using them. The flagship is the only thing you build, and
   fully worked up she is around 2.4x that, which is what makes twenty thousand
   gold and four hundred ingots a sane thing to spend. */
export const FLAGBASE = { speed: 6, guns: 8, hull: 60, cargo: 25 };

/* `per` is what one more level actually does — syncFlag reads it and the label
   is derived from it, so the number on the card and the number in the maths can
   never drift apart. They used to be written out twice.

   `stat` is the glyph the row is drawn with, not a field name. */
export const FLAGTIERS = {
  plate: { n: 'Hull Plating', icon: 'plate', per: 18, stat: 'hull'  },
  guns:  { n: 'Gun Decks',    icon: 'guns',  per: 3,  stat: 'guns'  },
  rig:   { n: 'Rigging',      icon: 'rig',   per: 3,  stat: 'speed' },
  /* Keyed `hold` because saves store it that way; it is called cargo on screen.
     Worth having now that the richest contracts ask for more than any captured
     hull can carry — before, she topped out at 75 against a largest consignment
     of 40, so the entire track was five thousand gold spent on nothing. */
  hold:  { n: 'Cargo Hold',   icon: 'cargo', per: 12, stat: 'cargo' }
};

export const TIER_KEYS = Object.keys(FLAGTIERS);
Object.values(FLAGTIERS).forEach(t => { t.eff = '+' + t.per; });

/* Each track eats a different material, so a captain who only ever fights ends
   up short of cloth and one who only ever trades ends up short of metal. */
const TIER_MATS = {
  plate: { metal: 6, wood: 2 },
  guns:  { metal: 8 },
  rig:   { cloth: 7, wood: 3 },
  hold:  { wood: 8, cloth: 2 }
};

export function tierCost(key, t) {
  /* The last two tiers cost extra on top of the linear ramp. */
  const cost = { gold: 300 * (t + 1) + (t >= 3 ? 200 * (t - 2) : 0) };
  const mats = TIER_MATS[key] || {};
  for (const m in mats) cost[m] = mats[m] * (t + 1);
  return cost;
}

export const FITTINGS = {
  grapple:  { n: 'Grappling Hooks',  desc: 'Board at 55% hull, not 40%',   cost: { gold: 800,  metal: 16, cloth: 8 } },
  magazine: { n: 'Powder Magazine',  desc: '+1 fire barrel every battle',  cost: { gold: 1600, metal: 18, wood: 12 } },
  copper:   { n: 'Copper Sheathing', desc: 'No storm or raid damage',      cost: { gold: 1900, metal: 30 } },
  chase:    { n: 'Chase Guns',       desc: 'Fires twice — second at 60%',  cost: { gold: 3000, metal: 34, wood: 16 } }
};

/* Permanent refits awarded by charters. */
export const BOONS = {
  diamond:    { n: 'Diamond Sails',              desc: '+2 flagship speed',    apply: f => { f.speed += 2; } },
  figurehead: { n: 'Royal Fortune Figurehead',   desc: '+2 flagship guns',     apply: f => { f.guns += 2; } },
  gilded:     { n: 'Gilded Wheel',               desc: '+14 flagship max hull', apply: f => { f.max += 14; } }
};
