/* Tuning knobs. Every number a designer might want to twist lives here. */

/* Lane security */
export const SEC_PER_WIN = 45;        // security gained by winning a battle on a lane
export const SEC_DECAY_PER_MIN = 1.0; // security lost per real minute

/* Voyages (trade runs) */
export const VOY_SEC_PER_DAY = 90;    // real seconds per unit of route length
export const VOY_MAX_ACTIVE = 6;      // simultaneous fleets at sea
export const RUSH_GEM_PER_MIN = 1;    // gems to skip one minute of sailing

/* Patrols knock a region's danger down by one step for this long. */
export const PATROL_MS = 10 * 60 * 1000;

/* Economy */
export const CARGO_PRICE = 12;
export const MAXTIER = 5;             // flagship upgrade tiers

/* Storage keys */
export const SAVE_KEY = 'saltpowder';
export const SETTINGS_KEY = 'sp_settings';
export const TUT_KEY = 'sp_tutdone';
