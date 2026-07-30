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

/* What a tier costs.

   This used to be a gentle linear ramp — 300, 600, 900, 1400, 1900, 2400 — and
   a whole track came to 7,500 gold. The trouble was never the ramp, it was what
   it was being measured against: a fight's listed reward is a small part of what
   it actually pays, because every beaten hull is a prize worth 150 to 1,200 gold
   on its own. A patrol lists 180 and hands you three ships. So a first tier at
   300 gold was one ransomed brig, and a player could sweep the Caribbean once
   and buy half a flagship.

   It compounds now. Each tier costs a little over twice the last, so the early
   ones stay quick — the first upgrade should land in the first few minutes,
   because a game that makes you wait for the first taste of progress is a game
   nobody gets to the second — and the top of a track is a genuine campaign.
   Materials compound too, more gently, which is what keeps scuttling worth
   doing when the purse is already fat.

     gold   420  861  1,765  3,618  7,418  15,207   = 29,289 a track
     metal    6   10     18      32     56      98  (plate)

   The whole flagship, every track and every fitting, is a little over 135,000 —
   against a Caribbean sweep worth two or three thousand and a Grand Banks
   bounty worth two. That is the arc of the game rather than an afternoon. */
export function tierCost(key, t) {
  const cost = { gold: Math.round(420 * Math.pow(2.05, t)) };
  const mats = TIER_MATS[key] || {};
  for (const m in mats) cost[m] = Math.round(mats[m] * Math.pow(1.75, t));
  return cost;
}

export const FITTINGS = {
  /* One-offs, and each one changes how a fight goes rather than adding to a
     number — so they are priced against the tiers they compete with for the
     same purse, not against the old flat rates. */
  grapple:  { n: 'Grappling Hooks',  desc: 'Board at 55% hull, not 40%',   cost: { gold: 2400,  metal: 34,  cloth: 18 } },
  magazine: { n: 'Powder Magazine',  desc: '+1 fire barrel every battle',  cost: { gold: 5200,  metal: 40,  wood: 26 } },
  copper:   { n: 'Copper Sheathing', desc: 'No storm or raid damage',      cost: { gold: 6400,  metal: 66 } },
  chase:    { n: 'Chase Guns',       desc: 'Fires twice — second at 60%',  cost: { gold: 11000, metal: 78,  wood: 36 } }
};

/* Permanent refits awarded by charters. */
export const BOONS = {
  diamond:    { n: 'Diamond Sails',              desc: '+2 flagship speed',    apply: f => { f.speed += 2; } },
  figurehead: { n: 'Royal Fortune Figurehead',   desc: '+2 flagship guns',     apply: f => { f.guns += 2; } },
  gilded:     { n: 'Gilded Wheel',               desc: '+14 flagship max hull', apply: f => { f.max += 14; } }
};
