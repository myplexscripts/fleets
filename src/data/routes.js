/* The fixed nodes on the chart.

   Three kinds live here, and they never overlap:

     cargo — a standing delivery run. Voyage only, never a battle.
     dive  — a known wreck. Voyage only, never a battle, gated by bell depth.
     patrol / escort / raid / blockade / hunt — a fight. Battle only.

   Every unlocked region carries at least three fights, and one of them is
   always a HUNT: open water with somebody working it, which never runs out and
   never gates. Fighting is the fun part, so there is never a moment on this
   chart where there is nothing to fight — and a captain with an empty purse and
   a holed fleet can always go and take one, which is the other half of why the
   game cannot dead-end.

   Charters and admirals are not here (see charters.js, bosses.js), and per-port
   cargo contracts are generated at runtime (see systems/contracts.js).

   A cargo lane asks three things of the ship you send: `qty` of cargo space to
   carry the consignment, `power` to see off whoever works that water, and
   `speed` to make the passage in good time. Falling short of the last two does
   not stop you sailing — it costs you odds and hours.

   Lanes also carry `riseMin` (how many real minutes before their danger climbs
   a step) and `dangerCap` (how bad they are allowed to get). Home water drifts
   slowly and never gets worse than Risky; the Grand Fleet Route is Hazardous
   again within the hour.

   Built by a factory because lane progress lives in the save, not here. */

export function makeRoutes() {
  return [
    /* ---- Caribbean ---- */
    { id: 'c1', region: 'caribbean', n: 'Havana → Nassau', type: 'cargo',
      good: 'sugar', qty: 8, power: 10, speed: 4, dest: 'Nassau', riseMin: 30, dangerCap: 1, danger: 0, len: 1,
      rew: { gold: 300 }, x: 150, y: 392 },


    { id: 'c2', region: 'caribbean', n: 'Nassau → Tortuga', type: 'cargo',
      good: 'rum', qty: 10, power: 16, speed: 5, dest: 'Tortuga', riseMin: 25, dangerCap: 2, danger: 1, len: 2,
      rew: { gold: 620 }, x: 98, y: 420 },

    { id: 'c3', region: 'caribbean', n: 'Patrol Windward Passage', type: 'patrol',
      danger: 1, power: 30, rew: { gold: 180, metal: 4, cloth: 2 }, x: 128, y: 346 },

    { id: 'c5', region: 'caribbean', n: 'Escort the Merchant Rose', type: 'escort',
      danger: 1, power: 35, rew: { gold: 460, cloth: 6, wood: 4 }, x: 176, y: 352 },

    { id: 'c4', region: 'caribbean', n: 'Raid Smuggler Cove', type: 'raid',
      danger: 2, power: 45, rew: { gold: 700, metal: 8, wood: 6 }, x: 72, y: 368 },

    { id: 'ch1', region: 'caribbean', n: 'The Leeward Shipping Lanes', type: 'hunt',
      danger: 1, rew: { gold: 220 }, x: 196, y: 316 },

    /* ---- Gulf Coast ---- */
    { id: 'g1', region: 'gulf', n: 'Tortuga → New Orleans', type: 'cargo',
      good: 'rum', qty: 18, power: 30, speed: 5, dest: 'New Orleans', riseMin: 20, dangerCap: 2, danger: 1, len: 3,
      rew: { gold: 1150 }, x: 60, y: 286 },


    { id: 'g2', region: 'gulf', n: 'Patrol Gulf Lanes', type: 'patrol',
      danger: 2, power: 60, rew: { gold: 300, metal: 7, cloth: 4 }, x: 98, y: 244 },

    { id: 'g6', region: 'gulf', n: 'Escort the Silver Barge', type: 'escort',
      danger: 2, power: 70, rew: { gold: 1200, cloth: 10, metal: 6 }, x: 146, y: 222 },

    { id: 'g3', region: 'gulf', n: 'Veracruz Tobacco Run', type: 'cargo',
      good: 'tobacco', qty: 22, power: 44, speed: 6, dest: 'Veracruz', riseMin: 18, dangerCap: 2, danger: 2, len: 3,
      rew: { gold: 1900 }, x: 54, y: 206 },

    { id: 'g4', region: 'gulf', n: 'Raid Navy Convoy', type: 'raid',
      danger: 2, power: 100, rew: { gold: 1700, metal: 16, wood: 10 }, x: 112, y: 180 },

    { id: 'gh1', region: 'gulf', n: 'The Florida Straits', type: 'hunt',
      danger: 2, rew: { gold: 520 }, x: 178, y: 292 },

    /* ---- Atlantic ---- */
    { id: 'a1', region: 'atlantic', n: 'Charleston Wine Run', type: 'cargo',
      good: 'wine', qty: 26, power: 58, speed: 6, dest: 'Charleston', riseMin: 15, dangerCap: 2, danger: 2, len: 4,
      rew: { gold: 3100 }, x: 238, y: 300 },


    { id: 'a2', region: 'atlantic', n: 'Patrol Bermuda Waters', type: 'patrol',
      danger: 2, power: 110, rew: { gold: 500, metal: 10, cloth: 6 }, x: 274, y: 242 },


    { id: 'a3', region: 'atlantic', n: 'Azores Blockade Break', type: 'blockade',
      danger: 2, power: 160, rew: { gold: 4000, metal: 22, wood: 14 }, x: 328, y: 212 },

    { id: 'a6', region: 'atlantic', n: 'Raid the Sugar Convoy', type: 'raid',
      danger: 2, power: 140, rew: { gold: 3200, metal: 18, wood: 12 }, x: 208, y: 246 },

    { id: 'ah1', region: 'atlantic', n: 'The Open Atlantic', type: 'hunt',
      danger: 2, rew: { gold: 980 }, x: 372, y: 194 },

    /* ---- Grand Fleet Route ----
       This region used to hold one locked dive and one locked cargo run, so the
       endgame was twenty-five cargo deliveries with nothing to fight while the
       wanted level crawled to 200. It fields a full set now. */
    { id: 'gr3', region: 'grand', n: 'Patrol the Approaches', type: 'patrol',
      danger: 2, power: 150, rew: { gold: 900, metal: 14, cloth: 8 }, x: 196, y: 108 },

    { id: 'gr4', region: 'grand', n: 'Raid the Treasure Flota', type: 'raid',
      danger: 2, power: 190, rew: { gold: 6200, metal: 26, wood: 16 }, x: 118, y: 96 },

    { id: 'gr5', region: 'grand', n: 'Break the Channel Blockade', type: 'blockade',
      danger: 2, power: 230, rew: { gold: 8400, metal: 32, wood: 20 }, x: 240, y: 54 },

    { id: 'grh1', region: 'grand', n: 'The Grand Banks', type: 'hunt',
      danger: 2, rew: { gold: 1600 }, x: 62, y: 118 },


    { id: 'gr1', region: 'grand', n: 'The Grand Fleet Route', type: 'cargo',
      good: 'spice', qty: 70, power: 90, speed: 8, dest: 'Marseille', riseMin: 12, dangerCap: 2, danger: 2, len: 6,
      rew: { gold: 10300 }, final: true, requiresBoss: 'grand', x: 314, y: 96 }
  ];
}
