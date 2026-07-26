/* One-off commissions. `loc` is where it is offered, `dest` the port it opens,
   `req` the charters that must be done first. A charter chain is the game's
   progression spine — it is how the map grows, and every port it opens starts
   offering cargo contracts.

   `prize.piece` names a collectible; between them the charters can complete
   every award set in data/collectibles.js. Dive-only and battle-only sets are
   not awarded here. */

export const CHARTERS = [
  { id: 'fb',   n: 'First Business',            loc: 'staug',        dest: 'charlestowne', t: 1,  req: [] },
  { id: 'ad',   n: 'American Dreams',           loc: 'charlestowne', dest: 'veracruz',     t: 2,  req: ['fb'] },
  { id: 'nh',   n: 'New Horizon',               loc: 'charlestowne', dest: 'jamestown',    t: 2,  req: ['fb'], prize: { piece: 'Portrait of a Lady Unknown' } },
  { id: 'd1',   n: 'Diplomacy I',               loc: 'veracruz',     dest: 'riodejaneiro', t: 2,  req: ['ad'] },
  { id: 'gd',   n: 'A Good Deed',               loc: 'veracruz',     dest: 'philadelphia', t: 2,  req: ['ad'], prize: { piece: 'Scrimshaw Whale Tooth' } },
  { id: 'sm',   n: 'The Sail Mates',            loc: 'jamestown',                          t: 3,  req: ['nh'], prize: { piece: 'Kast Cupboard' } },
  { id: 'd2',   n: 'Diplomacy II',              loc: 'riodejaneiro', dest: 'montevideo',   t: 3,  req: ['d1'] },
  { id: 'o3',   n: 'Outlaws III',               loc: 'riodejaneiro',                       t: 3,  req: ['d1'], prize: { boon: 'gilded' } },
  { id: 'ff',   n: "Fortune's Favor",           loc: 'philadelphia', dest: 'boston',       t: 3,  req: ['gd'], prize: { piece: "Sailor's Fiddle" } },
  { id: 'gs',   n: 'The General Store',         loc: 'philadelphia', dest: 'newyork',      t: 3,  req: ['gd'], prize: { piece: 'Jar with Four Faces' } },
  { id: 'stc',  n: 'Save the Children',         loc: 'boston',       dest: 'stjohns',      t: 4,  req: ['ff'], prize: { piece: 'Mourning Ring' } },
  { id: 'tom',  n: 'Taste of Money',            loc: 'boston',       dest: 'oporto',       t: 4,  req: ['ff'], prize: { piece: 'Joined Armchair' } },
  { id: 'ec2',  n: 'The Empty Cellar',          loc: 'newyork',                            t: 4,  req: ['gs'], prize: { gems: 3 } },
  { id: 'b1',   n: 'Brethren of the Coast I',   loc: 'montevideo',   dest: 'elsalvador',   t: 4,  req: ['d2'] },
  { id: 'ptk',  n: 'Promises to Keep',          loc: 'stjohns',                            t: 4,  req: ['stc'], prize: { piece: 'Commode' } },
  { id: 'le1',  n: 'The Lost Expedition I',     loc: 'stjohns',      dest: 'canary',       t: 4,  req: ['stc'], prize: { boon: 'diamond' } },
  { id: 'sca',  n: 'Scarlatina',                loc: 'stjohns',      dest: 'lisbon',       t: 4,  req: ['stc'] },
  { id: 'bs',   n: 'The Big Smoke',             loc: 'elsalvador',   dest: 'annapolis',    t: 5,  req: ['b1'], prize: { piece: 'Silver Reliquary Cross' } },
  { id: 'omo',  n: "The Old Man's Order",       loc: 'oporto',       dest: 'casablanca',   t: 5,  req: ['tom'] },
  { id: 'ps',   n: 'A Popular Stop',            loc: 'canary',       dest: 'quebec',       t: 5,  req: ['le1'] },
  { id: 'st',   n: 'The Sweet Tooth',           loc: 'canary',       dest: 'capetown',     t: 5,  req: ['le1'], prize: { gems: 3 } },
  { id: 'cn',   n: 'Cursed Night',              loc: 'lisbon',       dest: 'stmalo',       t: 5,  req: ['sca'], prize: { piece: 'Goa Stone Container' } },
  { id: 'dnh',  n: 'Do No Harm',                loc: 'lisbon',       dest: 'agadir',       t: 5,  req: ['sca'] },
  { id: 'tbl',  n: "Table Bay's Luck",          loc: 'capetown',     dest: 'benguela',     t: 6,  req: ['st'] },
  { id: 'mus',  n: 'The Musicians',             loc: 'agadir',       dest: 'brest',        t: 6,  req: ['dnh'], prize: { piece: 'Drum' } },
  { id: 'bts',  n: 'Before the Storm',          loc: 'agadir',       dest: 'larochelle',   t: 6,  req: ['dnh'] },
  { id: 'a1c',  n: 'Alliance I',                loc: 'stmalo',                             t: 6,  req: ['cn'], prize: { piece: 'Cabinet' } },
  { id: 'dte',  n: 'Door to Europe',            loc: 'benguela',     dest: 'bristol',      t: 7,  req: ['tbl'], prize: { piece: 'Still Life with Lemons' } },
  { id: 'a2c',  n: 'Alliance II',               loc: 'brest',        dest: 'bissau',       t: 7,  req: ['mus'] },
  { id: 'sj',   n: 'A Sweet Journey',           loc: 'larochelle',                         t: 7,  req: ['bts'], prize: { piece: 'Harbor Scene at Sunset' } },
  { id: 'hb',   n: 'Homeward Bound',            loc: 'bristol',                            t: 8,  req: ['dte'], prize: { boon: 'figurehead' } },
  { id: 'wti',  n: 'Welcoming the Irish',       loc: 'bristol',      dest: 'ziguinchor',   t: 8,  req: ['dte'] },
  { id: 'ga',   n: 'Giant Appetites',           loc: 'ziguinchor',   dest: 'galway',       t: 8,  req: ['wti'], prize: { piece: 'Statue of St. Livertin' } },
  { id: 'mt1',  n: 'Meet the Tributes I',       loc: 'galway',       dest: 'london',       t: 9,  req: ['ga'] },
  { id: 'pa',   n: 'A Piece of the Action',     loc: 'galway',                             t: 9,  req: ['ga'], prize: { gems: 4 } },
  { id: 'alv',  n: 'A Long Voyage',             loc: 'london',       dest: 'barcelona',    t: 9,  req: ['mt1'], prize: { piece: 'Oboe' } },
  { id: 'anc',  n: 'A New Cathedral',           loc: 'london',                             t: 10, req: ['mt1'], prize: { piece: 'Merry Company' } },
  { id: 'poet', n: 'The Poet',                  loc: 'barcelona',    dest: 'marseille',    t: 10, req: ['alv'] },
  { id: 'gr3',  n: 'Great Reputation III',      loc: 'marseille',                          t: 11, req: ['poet'], prize: { piece: "Officer's Outfit" } },
  { id: 'nm',   n: 'A New Medicine',            loc: 'marseille',                          t: 11, req: ['poet'], prize: { piece: 'Turkins Copper Field Flask' } }
];
