/* Tuning knobs. Every number a designer might want to twist lives here. */

/* Voyages — cargo runs and wreck dives */
export const VOY_SEC_PER_DAY = 90;    // real seconds per unit of route length
export const VOY_MAX_ACTIVE = 6;      // simultaneous fleets at sea
export const RUSH_GEM_PER_MIN = 1;    // gems to skip one minute of sailing

/* Patrols are the only thing that makes a region's water safer, and they wear
   off — so keeping a trade region quiet is ongoing work, not a one-time job. */
export const PATROL_MS = 10 * 60 * 1000;

/* Cargo contracts offered by charted ports */
export const CONTRACT_PAY_BASE = 1.75;   // multiple of the goods' market buy price
export const CONTRACT_PAY_PER_TIER = 0.06;

export const MAXTIER = 5;             // flagship upgrade tiers

/* Storage keys */
export const SAVE_KEY = 'saltpowder';
export const SETTINGS_KEY = 'sp_settings';
export const TUT_KEY = 'sp_tutdone';
