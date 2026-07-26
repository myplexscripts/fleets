/* The fixed lanes on the chart.

   Built by a factory because lane state (security, completions) lives in the
   save, not here — a fresh call gives clean definitions every new game. */

export function makeRoutes() {
  return [
    { id: 'c1',  region: 'caribbean', n: 'Havana → Nassau',            type: 'trade',    danger: 0, cargo: 8,  len: 1, power: 15,  rew: { reales: 260, parts: 2 },            x: 150, y: 392 },
    { id: 'c6',  region: 'caribbean', n: 'Wreck of the Santa Ana',     type: 'salvage',  danger: 0,            len: 1, hullreq: 50, rew: { reales: 150, parts: 6 },           ship: { type: 'schooner', chance: 0.30 }, x: 132, y: 440 },
    { id: 'c2',  region: 'caribbean', n: 'Nassau → Tortuga',           type: 'trade',    danger: 1, cargo: 12, len: 2, power: 30,  rew: { reales: 480, parts: 4 },            x: 98,  y: 420 },
    { id: 'c3',  region: 'caribbean', n: 'Patrol Windward Passage',    type: 'patrol',   danger: 1,            len: 1, power: 30,  rew: { reales: 120, parts: 2 },            x: 128, y: 346 },
    { id: 'c5',  region: 'caribbean', n: 'Escort the Merchant Rose',   type: 'escort',   danger: 1,            len: 2, power: 35,  rew: { reales: 420, parts: 3 },            x: 176, y: 352 },
    { id: 'c4',  region: 'caribbean', n: 'Raid Smuggler Cove',         type: 'raid',     danger: 2,            len: 2, power: 45,  rew: { reales: 650, parts: 8 },            x: 72,  y: 368 },

    { id: 'g1',  region: 'gulf',      n: 'Tortuga → New Orleans',      type: 'trade',    danger: 1, cargo: 20, len: 3, power: 55,  rew: { reales: 900, parts: 5 },            x: 60,  y: 286 },
    { id: 'g5',  region: 'gulf',      n: 'Graveyard Shoals',           type: 'salvage',  danger: 1,            len: 2, hullreq: 110, rew: { reales: 300, parts: 10, gems: 1 }, ship: { type: 'brig', chance: 0.35 }, x: 28, y: 262 },
    { id: 'g2',  region: 'gulf',      n: 'Patrol Gulf Lanes',          type: 'patrol',   danger: 2,            len: 2, power: 60,  rew: { reales: 200, parts: 4, gems: 1 },    x: 98,  y: 244 },
    { id: 'g6',  region: 'gulf',      n: 'Escort the Silver Barge',    type: 'escort',   danger: 2,            len: 3, power: 70,  rew: { reales: 1100, parts: 6 },           x: 146, y: 222 },
    { id: 'g3',  region: 'gulf',      n: 'Veracruz Silver Run',        type: 'trade',    danger: 2, cargo: 28, len: 3, power: 80,  rew: { reales: 1500, parts: 8, gems: 1 },   x: 54,  y: 206 },
    { id: 'g4',  region: 'gulf',      n: 'Raid Navy Convoy',           type: 'raid',     danger: 3,            len: 3, power: 100, rew: { reales: 1400, parts: 14, gems: 2 },  x: 112, y: 180 },

    { id: 'a1',  region: 'atlantic',  n: 'Charleston Tobacco Run',     type: 'trade',    danger: 2, cargo: 40, len: 4, power: 120, rew: { reales: 2400, parts: 10, gems: 1 },  x: 238, y: 300 },
    { id: 'a4',  region: 'atlantic',  n: 'Bermuda Deeps',              type: 'salvage',  danger: 2,            len: 3, hullreq: 160, rew: { reales: 500, parts: 14, gems: 1 }, ship: { type: 'frigate', chance: 0.35 }, x: 308, y: 296 },
    { id: 'a2',  region: 'atlantic',  n: 'Patrol Bermuda Waters',      type: 'patrol',   danger: 2,            len: 2, power: 110, rew: { reales: 350, parts: 6, gems: 1 },    x: 274, y: 242 },
    { id: 'a3',  region: 'atlantic',  n: 'Azores Blockade Break',      type: 'blockade', danger: 3,            len: 5, power: 160, rew: { reales: 3200, parts: 20, gems: 3 },  x: 328, y: 212 },

    { id: 'gr1', region: 'grand',     n: 'The Grand Fleet Route',      type: 'trade',    danger: 3, cargo: 60, len: 6, power: 210, rew: { reales: 8000, parts: 30, gems: 6 },  final: true, requiresBoss: 'grand', x: 314, y: 96 }
  ];
}
