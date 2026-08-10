/* Regions, danger scale, mission taxonomy, home port. */

export const REGIONS = {
  caribbean: { n: 'Caribbean',         tier: 1 },
  gulf:      { n: 'Gulf Coast',        tier: 2 },
  atlantic:  { n: 'Atlantic',          tier: 3 },
  grand:     { n: 'Grand Fleet Route', tier: 4 }
};

/* Three levels, and only three. A scale a player has to squint at to rank is a
   scale that is not telling them anything. */
export const DNAMES  = ['SAFE', 'RISKY', 'HAZARDOUS'];
/* Which of the design system's status tones each step wears. Names, not
   colours: data says what a thing IS and the stylesheet decides what that
   looks like, so a danger bar cannot drift away from every other bar in the
   game the way it did while this list held raw CSS values. */
export const DTONES  = ['good', 'warn', 'bad'];
/* The chart draws into SVG, which cannot read a CSS custom property from a
   stylesheet, so these are the same three tones as literals for the markers.
   They are the only hex values outside styles/palette.css, and they exist
   for that one reason. */
export const DHEX    = ['#8DA58A', '#D49A3A', '#C86A4A'];
export const MAX_DANGER = DNAMES.length - 1;

export const HOME = { x: 196, y: 452 };

/* Extra notoriety on top of the danger-scaled base, by mission type. */
export const NOTO_BONUS = {
  cargo: 0, dive: 2, hunt: 6, convoy: 9, patrol: 4, escort: 6, raid: 10, blockade: 14, charter: 8,
  bounty: 16
};

/* Voyages leave port and come back later; battles happen where you stand. No
   mission is ever both. */
export const VOYAGE_TYPES = ['cargo', 'dive'];
export const BATTLE_TYPES = ['hunt', 'convoy', 'patrol', 'escort', 'raid', 'blockade', 'charter', 'boss', 'bounty'];

/* One clause each. The chips carry the numbers; the tip only says what the
   mission is for. */
export const MTYPE = {
  cargo:    { n: 'Cargo Run',       tip: 'Deliver the goods. Never a fight.' },
  hunt:     { n: 'Hunting Ground',  tip: 'Open water. There is always somebody working it.' },
  convoy:   { n: 'Shipping Convoy', tip: 'Loaded merchants under escort. The hold is the prize, not the fight.' },
  dive:     { n: 'Wreck Dive',      tip: 'Chests sell as they come up. Never a fight.' },
  patrol:   { n: 'Patrol',          tip: 'Clears every lane in the region a step.' },
  raid:     { n: 'Raid',            tip: 'One large payout.' },
  escort:   { n: 'Escort',          tip: 'Keep the merchant alive or lose.' },
  blockade: { n: 'Blockade Break',  tip: 'The hardest fight on the chart.' },
  boss:     { n: 'Admiral',         tip: 'Flagship must sail. Opens the next region.' },
  charter:  { n: 'Charter',         tip: 'One-off. Opens a port for good.' },
  bounty:   { n: 'Bounty',          tip: 'She sails when the clock runs out. Harder than this water, and pays like it.' }
};
