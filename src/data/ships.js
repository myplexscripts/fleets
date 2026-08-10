/* Ship classes, names, and the geometry/palettes the placeholder art uses.
   `cost` is in gold; `ransom` is the gold a captured crew fetches. */

export const TYPES = {
  /* `cost` is what the shipwright asks; `ransom` is what her crew fetches when
     you take her. Buying is deliberately the expensive way to get a hull —
     the cheap way is to go and take one — so the two are not close. */
  schooner: { n: 'Schooner',    speed: 8, guns: 3,  hull: 20, cargo: 10, cost: 900,  rep: 3, salv: 6,  ransom: 150 },
  brig:     { n: 'Brig',        speed: 5, guns: 5,  hull: 35, cargo: 20, cost: 2100, rep: 4, salv: 10, ransom: 300 },
  frigate:  { n: 'Frigate',     speed: 4, guns: 8,  hull: 55, cargo: 30, cost: 5200, rep: 6, salv: 16, ransom: 600 },
  manowar:  { n: "Man o' War",  speed: 2, guns: 12, hull: 90, cargo: 50, cost: 12000, rep: 8, salv: 26, ransom: 1200 }
};

/* Ship names live in data/names.js now — sorted by class and by faction, and
   long enough that a session does not repeat itself. A hull you capture keeps
   the name she was flying, so the fleet list is a record of who you beat. */

/* Hull length / height / mast positions / rig style for the generated art. */
export const SHIPCFG = {
  schooner: { L: 64,  H: 40, masts: [24, 42],     rig: 'fore' },
  brig:     { L: 78,  H: 48, masts: [24, 50],     rig: 'sq' },
  frigate:  { L: 94,  H: 56, masts: [22, 48, 72], rig: 'sq' },
  manowar:  { L: 112, H: 66, masts: [24, 54, 86], rig: 'sq' },
  merchant: { L: 84,  H: 50, masts: [26, 56],     rig: 'sq' },
  flagship: { L: 100, H: 62, masts: [22, 52, 80], rig: 'sq' }
};

/* [upper sail, lower sail, flag, hull] */
/* Sail, shadowed sail, trim, hull — all four drawn from the harmony palette so
   the ships sit in the same world as the panels around them. These are
   illustration rather than interface, but they are still large graphics on a
   Navy ground, so every value here clears 3:1 against it. */
export const PALETTES = {
  player:   ['#E2D6B6', '#A68F3A', '#BD913B', '#15273E'],  /* Sand / Olive Gold / Gold */
  enemy:    ['#8DA58A', '#6B7280', '#C86A4A', '#15273E'],  /* Sage / Slate / Terracotta */
  boss:     ['#C86A4A', '#5B3A5E', '#E2D6B6', '#15273E'],  /* Terracotta / Berry / Sand */
  merchant: ['#6CB7B2', '#4C6F8A', '#2B4F6F', '#15273E'],  /* Seafoam / Aegean / Ocean */
  flag:     ['#F2EFE6', '#BD913B', '#E07A6A', '#15273E']   /* Ivory / Gold / Coral */
};

/* Which type/palette pairs get pre-rendered for the battle scene. */
export const ART_COMBOS = [
  ['schooner', 'player'], ['brig', 'player'], ['frigate', 'player'], ['manowar', 'player'],
  ['schooner', 'enemy'],  ['brig', 'enemy'],  ['frigate', 'enemy'],  ['manowar', 'enemy'],
  ['schooner', 'boss'],   ['brig', 'boss'],   ['frigate', 'boss'],   ['manowar', 'boss'],
  ['merchant', 'merchant'], ['flagship', 'flag']
];
