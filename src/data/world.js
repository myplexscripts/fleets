/* Regions, danger scale, mission taxonomy, home port. */

export const REGIONS = {
  caribbean: { n: 'Caribbean',         tier: 1 },
  gulf:      { n: 'Gulf Coast',        tier: 2 },
  atlantic:  { n: 'Atlantic',          tier: 3 },
  grand:     { n: 'Grand Fleet Route', tier: 4 }
};

export const DNAMES  = ['SAFE', 'HAZARDOUS', 'DANGEROUS', 'TREACHEROUS'];
export const DCOLORS = ['var(--grn)', 'var(--yel)', 'var(--org)', 'var(--red)'];
export const DHEX    = ['#63c06a', '#d9c34a', '#d9883a', '#d94a3a'];

export const HOME = { x: 196, y: 452 };

/* Extra notoriety on top of the danger-scaled base, by mission type. */
export const NOTO_BONUS = {
  cargo: 0, dive: 2, patrol: 4, escort: 6, raid: 10, blockade: 14, charter: 8
};

/* Voyages leave port and come back later; battles happen where you stand. No
   mission is ever both. */
export const VOYAGE_TYPES = ['cargo', 'dive'];
export const BATTLE_TYPES = ['patrol', 'escort', 'raid', 'blockade', 'charter', 'boss'];

/* One clause each. The chips carry the numbers; the tip only says what the
   mission is for. */
export const MTYPE = {
  cargo:    { n: 'Cargo Run',       tip: 'Deliver the goods. Never a fight.' },
  dive:     { n: 'Wreck Dive',      tip: 'Chests sell as they come up. Never a fight.' },
  patrol:   { n: 'Patrol',          tip: 'Clears every lane in the region a step.' },
  raid:     { n: 'Raid',            tip: 'One large payout.' },
  escort:   { n: 'Escort',          tip: 'Keep the merchant alive or lose.' },
  blockade: { n: 'Blockade Break',  tip: 'The hardest fight on the chart.' },
  boss:     { n: 'Admiral',         tip: 'Flagship must sail. Opens the next region.' },
  charter:  { n: 'Charter',         tip: 'One-off. Opens a port for good.' }
};
