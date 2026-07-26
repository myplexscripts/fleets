/* The fixed nodes on the chart.

   Three kinds live here, and they never overlap:

     cargo — a standing delivery run. Voyage only, never a battle.
     dive  — a known wreck. Voyage only, never a battle, gated by bell depth.
     patrol / escort / raid / blockade — a fight. Battle only, never a voyage.

   Charters and admirals are not here (see charters.js, bosses.js), and per-port
   cargo contracts are generated at runtime (see systems/contracts.js).

   Built by a factory because lane progress lives in the save, not here. */

export function makeRoutes() {
  return [
    /* ---- Caribbean ---- */
    { id: 'c1', region: 'caribbean', n: 'Havana → Nassau', type: 'cargo',
      good: 'sugar', qty: 8, dest: 'Nassau', danger: 0, len: 1,
      rew: { reales: 300 }, x: 150, y: 392 },

    { id: 'c6', region: 'caribbean', n: 'Wreck of the Santa Ana', type: 'dive',
      depth: 1, chestMin: 2, chestMax: 4, len: 1,
      rew: { metal: 3, wood: 2 }, x: 132, y: 440 },

    { id: 'c2', region: 'caribbean', n: 'Nassau → Tortuga', type: 'cargo',
      good: 'rum', qty: 10, dest: 'Tortuga', danger: 1, len: 2,
      rew: { reales: 620 }, x: 98, y: 420 },

    { id: 'c3', region: 'caribbean', n: 'Patrol Windward Passage', type: 'patrol',
      danger: 1, power: 30, rew: { reales: 180, metal: 4, cloth: 2 }, x: 128, y: 346 },

    { id: 'c5', region: 'caribbean', n: 'Escort the Merchant Rose', type: 'escort',
      danger: 1, power: 35, rew: { reales: 460, cloth: 6, wood: 4 }, x: 176, y: 352 },

    { id: 'c4', region: 'caribbean', n: 'Raid Smuggler Cove', type: 'raid',
      danger: 2, power: 45, rew: { reales: 700, metal: 8, wood: 6 }, x: 72, y: 368 },

    /* ---- Gulf Coast ---- */
    { id: 'g1', region: 'gulf', n: 'Tortuga → New Orleans', type: 'cargo',
      good: 'rum', qty: 18, dest: 'New Orleans', danger: 1, len: 3,
      rew: { reales: 1150 }, x: 60, y: 286 },

    { id: 'g5', region: 'gulf', n: 'Graveyard Shoals', type: 'dive',
      depth: 2, chestMin: 3, chestMax: 5, len: 2,
      rew: { metal: 6, wood: 4 }, x: 28, y: 262 },

    { id: 'g2', region: 'gulf', n: 'Patrol Gulf Lanes', type: 'patrol',
      danger: 2, power: 60, rew: { reales: 300, metal: 7, cloth: 4 }, x: 98, y: 244 },

    { id: 'g6', region: 'gulf', n: 'Escort the Silver Barge', type: 'escort',
      danger: 2, power: 70, rew: { reales: 1200, cloth: 10, metal: 6 }, x: 146, y: 222 },

    { id: 'g3', region: 'gulf', n: 'Veracruz Tobacco Run', type: 'cargo',
      good: 'tobacco', qty: 22, dest: 'Veracruz', danger: 2, len: 3,
      rew: { reales: 1900 }, x: 54, y: 206 },

    { id: 'g4', region: 'gulf', n: 'Raid Navy Convoy', type: 'raid',
      danger: 3, power: 100, rew: { reales: 1500, metal: 16, wood: 10, gems: 1 }, x: 112, y: 180 },

    /* ---- Atlantic ---- */
    { id: 'a1', region: 'atlantic', n: 'Charleston Wine Run', type: 'cargo',
      good: 'wine', qty: 26, dest: 'Charleston', danger: 2, len: 4,
      rew: { reales: 3100 }, x: 238, y: 300 },

    { id: 'a4', region: 'atlantic', n: 'Bermuda Deeps', type: 'dive',
      depth: 3, chestMin: 3, chestMax: 6, len: 3,
      rew: { metal: 10, cloth: 5 }, x: 308, y: 296 },

    { id: 'a2', region: 'atlantic', n: 'Patrol Bermuda Waters', type: 'patrol',
      danger: 2, power: 110, rew: { reales: 500, metal: 10, cloth: 6 }, x: 274, y: 242 },

    { id: 'a5', region: 'atlantic', n: 'The Azores Trench', type: 'dive',
      depth: 4, chestMin: 4, chestMax: 7, len: 4,
      rew: { metal: 15, cloth: 8, gems: 1 }, x: 350, y: 268 },

    { id: 'a3', region: 'atlantic', n: 'Azores Blockade Break', type: 'blockade',
      danger: 3, power: 160, rew: { reales: 3400, metal: 22, wood: 14, gems: 3 }, x: 328, y: 212 },

    /* ---- Grand Fleet Route ---- */
    { id: 'gr2', region: 'grand', n: 'The Abyssal Shelf', type: 'dive',
      depth: 5, chestMin: 5, chestMax: 9, len: 5,
      rew: { metal: 24, cloth: 14, gems: 2 }, requiresBoss: 'atlantic', x: 268, y: 78 },

    { id: 'gr1', region: 'grand', n: 'The Grand Fleet Route', type: 'cargo',
      good: 'spice', qty: 40, dest: 'Marseille', danger: 3, len: 6,
      rew: { reales: 9500, gems: 4 }, final: true, requiresBoss: 'grand', x: 314, y: 96 }
  ];
}
