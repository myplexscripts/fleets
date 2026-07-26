/* The flagship: base stats, upgrade tracks, fittings, and charter boons. */

export const FLAGBASE = { speed: 5, guns: 6, hull: 45, cargo: 25 };

/* `eff` is the whole description: what one more level does, as a stat and a
   glyph. No prose — the row is meant to be read, not studied. */
export const FLAGTIERS = {
  plate: { n: 'Hull Plating', icon: 'plate', eff: '+12', stat: 'hull' },
  guns:  { n: 'Gun Decks',    icon: 'guns',  eff: '+2',  stat: 'guns' },
  rig:   { n: 'Rigging',      icon: 'rig',   eff: '+2',  stat: 'speed' },
  /* Keyed `hold` because saves store it that way; it is called cargo on screen. */
  hold:  { n: 'Cargo Hold',   icon: 'cargo', eff: '+10', stat: 'cargo' }
};

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
