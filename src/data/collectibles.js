/* Collectible sets.

   Accumulated across the whole life of a save and never spent. Pieces arrive two
   ways: `award` sets are handed out by specific charters (see CHARTERS.prize),
   and `drop` sets are pure luck from wreck dives and captured ships. A set is
   its own reward — completing one changes nothing mechanically, it just fills a
   shelf in the great cabin. */

export const SETS = {
  gallery: {
    n: "The Governor's Gallery", kind: 'Art', source: 'award',
    pieces: ['Harbor Scene at Sunset', 'Merry Company', 'Portrait of a Lady Unknown', 'Still Life with Lemons']
  },
  curios: {
    n: 'Cabinet of Curiosities', kind: 'Trinkets', source: 'award',
    pieces: ['Jar with Four Faces', 'Goa Stone Container', 'Turkins Copper Field Flask', 'Scrimshaw Whale Tooth', 'Mourning Ring']
  },
  consort: {
    n: "The Ship's Consort", kind: 'Instruments', source: 'award',
    pieces: ['Drum', 'Oboe', "Sailor's Fiddle"]
  },
  cabin: {
    n: 'Furnishings of the Great Cabin', kind: 'Furniture', source: 'award',
    pieces: ['Kast Cupboard', 'Joined Armchair', 'Cabinet', 'Commode']
  },
  reliquary: {
    n: 'Reliquary of the Coast', kind: 'Relics', source: 'award',
    pieces: ['Statue of St. Livertin', "Officer's Outfit", 'Silver Reliquary Cross']
  },
  /* Dive-only. Nothing on land will ever hand you one of these. */
  depths: {
    n: 'Salvage from the Deep', kind: 'Salvage', source: 'drop',
    pieces: ['Coral-Grown Astrolabe', "Drowned Man's Compass", 'Barnacled Sextant', 'Bell of the Santa Ana', 'Silted Spanish Crucifix']
  },
  spoils: {
    n: 'Spoils of the Line', kind: 'Spoils', source: 'drop',
    pieces: ["Admiral's Spyglass", 'Shot-Split Ensign', 'Powder Horn of the Tenacious', 'Captured Signal Book']
  }
};

export const SET_KEYS = Object.keys(SETS);

/* Reverse index: piece name -> set key. Built once. */
export const PIECE_SET = {};
SET_KEYS.forEach(k => SETS[k].pieces.forEach(p => { PIECE_SET[p] = k; }));

/* Pools for random drops, by where the drop came from. */
export const DROP_POOLS = {
  dive: SETS.depths.pieces,
  battle: SETS.spoils.pieces
};
