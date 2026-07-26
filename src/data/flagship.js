/* The flagship: base stats, upgrade tracks, fittings, and charter boons. */

export const FLAGBASE = { speed: 5, guns: 6, hull: 45, cargo: 25 };

export const FLAGTIERS = {
  plate: { n: 'Hull Plating', icon: 'plate', desc: '+12 max hull per level. More hull means the flagship survives longer in a fight.' },
  guns:  { n: 'Gun Decks',    icon: 'guns',  desc: '+2 guns per level. Guns are the main source of damage you deal.' },
  rig:   { n: 'Rigging',      icon: 'rig',   desc: '+2 speed per level. Speed shortens trade runs and helps you escape a losing battle.' },
  /* Keyed `hold` because saves store it that way; it is called cargo on screen. */
  hold:  { n: 'Cargo Hold',   icon: 'cargo', desc: '+10 cargo per level. One ship sails a run, so her cargo space is what decides which contracts she can take at all.' }
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
  grapple:  { n: 'Grappling Hooks',  desc: 'Board enemy ships at 55% hull instead of 40% — you can capture them much earlier in a fight.', cost: { gold: 800,  metal: 16, cloth: 8 } },
  magazine: { n: 'Powder Magazine',  desc: 'Start every battle with one extra fire barrel.',                                               cost: { gold: 1600, metal: 18, wood: 12 } },
  copper:   { n: 'Copper Sheathing', desc: 'The flagship takes no damage from storms or from a cargo run gone wrong.',                     cost: { gold: 1900, metal: 30 } },
  chase:    { n: 'Chase Guns',       desc: 'The flagship fires twice each round. The second shot deals 60% damage.',                       cost: { gold: 3000, metal: 34, wood: 16 } }
};

/* Permanent refits awarded by charters. */
export const BOONS = {
  diamond:    { n: 'Diamond Sails',              desc: '+2 flagship speed',    apply: f => { f.speed += 2; } },
  figurehead: { n: 'Royal Fortune Figurehead',   desc: '+2 flagship guns',     apply: f => { f.guns += 2; } },
  gilded:     { n: 'Gilded Wheel',               desc: '+14 flagship max hull', apply: f => { f.max += 14; } }
};
