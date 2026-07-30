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

export const NAMES = ['Adder', 'Tempest', 'Marigold', 'Vixen', 'Corsair', 'Reliant', 'Sea Wolf',
  'Fortune', 'Kestrel', 'Gallant', 'Widow', 'Petrel', 'Avarice', 'Dauntless', 'Sparrow',
  'Grim Tide', 'Halcyon', 'Red Wake', 'Serpent', 'Osprey'];

export const ENAMES = ['HMS Fortress', 'San Cristobal', 'San Juan Bautista', 'HMS Defiance',
  'La Dama Negra', 'HMS Sovereign', 'El Halcón', 'HMS Vigilant', 'Santa Lucía', 'HMS Ardent',
  'El Conquistador', 'HMS Resolute'];

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
export const PALETTES = {
  player:   ['#d6cfba', '#bdb49b', '#c8b060', '#171310'],
  enemy:    ['#6f8ba0', '#5a7386', '#a03028', '#171310'],
  boss:     ['#8a2a2a', '#5e1a1a', '#e8d89a', '#0d0808'],
  merchant: ['#a8c4d8', '#8aa8bd', '#3a7ab0', '#171310'],
  flag:     ['#efe3ae', '#d9c98a', '#d94a3a', '#120e0a']
};

/* Which type/palette pairs get pre-rendered for the battle scene. */
export const ART_COMBOS = [
  ['schooner', 'player'], ['brig', 'player'], ['frigate', 'player'], ['manowar', 'player'],
  ['schooner', 'enemy'],  ['brig', 'enemy'],  ['frigate', 'enemy'],  ['manowar', 'enemy'],
  ['schooner', 'boss'],   ['brig', 'boss'],   ['frigate', 'boss'],   ['manowar', 'boss'],
  ['merchant', 'merchant'], ['flagship', 'flag']
];
