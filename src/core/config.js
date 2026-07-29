/* Tuning knobs. Every number a designer might want to twist lives here. */

/* Voyages — cargo runs and wreck dives.

   A voyage sails under exactly one ship. That is the whole trading puzzle:
   whether any single hull you own is big enough for the job. Pooling three of
   them would answer it for free. */
export const VOY_SHIPS = 1;           // ships per voyage
export const VOY_SEC_PER_DAY = 90;    // real seconds per unit of route length
export const VOY_MAX_ACTIVE = 6;      // simultaneous fleets at sea
export const RUSH_GOLD_PER_MIN = 200; // gold to skip one minute of sailing
export const CARGO_PER_CHEST = 5;     // cargo space one salvaged chest takes up

/* Ships in a battle line: front, centre, rear. */
export const BATTLE_SHIPS = 3;

/* Lane danger.

   A lane's danger climbs on its own in real time. Two things push it back down:
   fighting that lane clears one step off it, and patrolling its region clears a
   step off every lane at once. Neither is compulsory — danger never blocks
   trade, it only decides how roughly a cargo run is handled on the way, so
   running a bad lane anyway is always the player's call. Each lane sets its own
   `riseMin` and `dangerCap`, so home waters stay gentle and deep routes do
   not. */
export const DANGER_RISE_MIN_DEFAULT = 25;
export const LANE_CLEAR_STEP = 1;     // danger steps a won lane battle removes

/* A patrol clears a whole region at once, and wears off. */
export const PATROL_MS = 10 * 60 * 1000;

/* Wanted level.

   Heat cools on its own, because heat you earned three days ago is not heat.
   Slow enough that a session's work is not undone between sittings, fast enough
   that the number means "lately" rather than "ever". A summoned admiral latches
   and never cools, so a boss can never be lost by taking too long over her. */
export const WANTED_COOL_PER_MIN = 0.35;

/* The free careen.

   A fleet at the bottom of its luck — every hull holed, an empty purse, nothing
   in the hold to sell — used to be a dead save, because the market never bought
   materials back and repairs cost coin nobody had. Careening is the way out:
   run her up the beach and work on the hull yourself. It costs time instead of
   money, it only ever touches the flagship, and paying a shipwright is still
   strictly better — so it is an emergency, never a strategy. */
export const CAREEN_COOLDOWN_MS = 12 * 60 * 1000;
export const CAREEN_TO = 0.6;   // how sound she comes off the beach

/* An enemy line-up is drawn once and stays drawn until it is fought or the
   water it came from changes. Reopening a mission used to redraw it, which was
   a reroll wearing a disguise. */
export const DRAW_TTL_MS = 30 * 60 * 1000;

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
