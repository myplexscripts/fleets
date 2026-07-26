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

export const MTYPE = {
  cargo:    { n: 'Cargo Run',       tip: 'Load the goods named below and deliver them. No fighting — a cargo run is a delivery, and pays far better than dumping the same goods at the market.' },
  dive:     { n: 'Wreck Dive',      tip: 'Nobody guards a wreck, so there is no fight here. What stops you is depth: your diving bell has to reach it. Chests are sold as they come up.' },
  patrol:   { n: 'Patrol',          tip: 'A fight for modest money. Winning suppresses the danger of this whole region for a while, which makes every cargo run through it safer.' },
  raid:     { n: 'Raid',            tip: 'A fight for a large one-off payout in reales and materials.' },
  escort:   { n: 'Escort',          tip: 'A fight where you must also keep the merchant ship alive. If she sinks you lose, however well you are doing. Pays in cloth and timber.' },
  blockade: { n: 'Blockade Break',  tip: 'The hardest ordinary fight on the chart, and the largest ordinary reward. Bring your best three ships.' },
  boss:     { n: 'Admiral',         tip: 'The region admiral. Your flagship must be in the line. Beating one unlocks the next region of the map.' },
  charter:  { n: 'Charter',         tip: 'A one-off commission you can only take once. Winning permanently opens a new port, and often hands you a collectible or a flagship refit.' }
};
