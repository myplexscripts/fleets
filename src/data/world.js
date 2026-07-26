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
  trade: 0, port: 0, salvage: 2, patrol: 4, escort: 6, raid: 10, blockade: 14, charter: 8
};

export const MTYPE = {
  trade:    { n: 'Trade Lane',      tip: 'Attack it to clear the raiders, then run cargo along it for the best steady money in the game. Needs goods from the Market.' },
  port:     { n: 'Supply Lane',     tip: 'A standing contract with a port you have charted. Same as a trade lane — clear it, then run goods along it for a reliable payout.' },
  patrol:   { n: 'Patrol',          tip: 'A pure fight for little money. Winning drops the danger of every lane in this region by one step for a while.' },
  raid:     { n: 'Raid',            tip: 'Always a fight, never a trade run. Hard enemies, big one-off payout in reales and parts.' },
  escort:   { n: 'Escort',          tip: 'A fight where you must also keep the merchant ship alive. If she sinks you lose, however well you are doing.' },
  salvage:  { n: 'Salvage',         tip: "No enemies — send ships to haul up a wreck. Success depends on your fleet's total hull, not its guns. Sometimes you recover a free ship." },
  blockade: { n: 'Blockade Break',  tip: 'The hardest ordinary fight on the chart, and the largest ordinary reward. Bring your best three ships.' },
  boss:     { n: 'Admiral',         tip: 'The region boss. Your flagship must be in the line. Beating one unlocks the next region of the map.' },
  charter:  { n: 'Charter',         tip: 'A one-off job you can only do once. Winning permanently opens a new port, and often hands you a relic or a flagship upgrade.' }
};
