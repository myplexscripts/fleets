/* Tuning knobs. Every number a designer might want to twist lives here. */

/* Voyages — cargo runs and wreck dives */
export const VOY_SEC_PER_DAY = 90;    // real seconds per unit of route length
export const VOY_MAX_ACTIVE = 6;      // simultaneous fleets at sea
export const RUSH_GOLD_PER_MIN = 200; // gold to skip one minute of sailing

/* Lane danger.

   A lane's danger climbs on its own in real time and is pushed back down one
   step by sweeping it. Trade is never blocked by it — danger only decides how
   roughly a cargo run is handled on the way. Each lane sets its own `riseMin`
   and `dangerCap`, so the home waters stay gentle and the deep routes do not. */
export const DANGER_RISE_MIN_DEFAULT = 25;
export const SWEEP_STEP = 1;          // danger steps removed by one won sweep

/* A patrol clears a whole region at once, and wears off. */
export const PATROL_MS = 10 * 60 * 1000;

/* Cargo contracts offered by charted ports */
export const CONTRACT_PAY_BASE = 1.75;   // multiple of the goods' market buy price
export const CONTRACT_PAY_PER_TIER = 0.06;

export const MAXTIER = 5;             // flagship upgrade tiers

/* Old saves kept gems as a second currency; this is what one was worth. */
export const GEM_TO_GOLD = 200;

/* Storage keys */
export const SAVE_KEY = 'saltpowder';
export const SETTINGS_KEY = 'sp_settings';
export const TUT_KEY = 'sp_tutdone';
