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

/* ---- gunnery ----

   A battle runs on a clock rather than in turns. Every ship reloads at her own
   rate, fires the moment she is loaded, and the player's job is not to order
   each broadside — it is to spot the moments worth spending a brace, a boarding
   party or a barrel on.

   Reload time is BASE / (1 + speed * PER_SPEED), floored so that a fully
   worked-up flagship cannot fire so fast that nothing else in the fight
   matters. At these numbers a Man o' War (speed 2) takes about 6.5 seconds
   between broadsides and a schooner (speed 8) about 3.2.

   These were half this to begin with, and half this was unreadable. Six hulls
   on screen at a shot every 1.7 seconds is four or five things happening every
   second — damage numbers, log lines, hull bars, meters — and no gap between
   them wide enough to look at any of it, let alone decide something. The fight
   was legible in aggregate and illegible in detail, which is the worst place
   for an auto-battle to sit: it looked like it was playing itself.

   At these numbers a broadside is an event. There is time to watch a meter
   climb, see whose it is, and get a hand to Brace before it lands. */
export const RELOAD_BASE_MS = 9800;
export const RELOAD_PER_SPEED = 0.26;
export const RELOAD_FLOOR_MS = 1800;

/* The run-in. Sails on the horizon are not sails in range, so the first
   broadside of a battle takes longer to come than the ones after it — the first
   reload is stretched by this much.

   It reads as ships closing, but it exists for a harder reason: two ships
   against two must not be able to destroy the player before the player has had
   a chance to leave. The run-in buys those seconds once, at the start, without
   slowing the rest of the fight down.

   It was 2.4 when a reload was half what it is now. The seconds it had to buy
   are in the reload itself these days, so it only has to be long enough to read
   as a closing rather than as a stall. */
export const APPROACH_MULT = 1.5;

/* Bracing: what it costs you and what it buys. Damage taken is multiplied by
   BRACE_MULT for BRACE_MS, and your own reloads crawl while you are doing it —
   everybody is below decks holding on rather than serving the guns. */
export const BRACE_MS = 5000;
export const BRACE_COOLDOWN_MS = 11000;
export const BRACE_MULT = 0.35;
export const BRACE_RELOAD_MULT = 0.35;

/* Boarding needs her beaten down first, and the party needs time to re-form. */
export const BOARD_COOLDOWN_MS = 9000;

/* An admiral with the broadside gimmick charges one every so often, and shows
   it coming for long enough that bracing is a decision rather than a reflex. */
export const VOLLEY_EVERY_MS = 16000;
export const VOLLEY_WARN_MS = 3000;

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

/* The free repair.

   A fleet at the bottom of its luck — every hull holed, an empty purse, nothing
   in the hold to sell — would otherwise be a dead save, because nothing buys
   materials back and every repair costs coin nobody has.

   It is offered on exactly one condition: the flagship is damaged and you
   cannot afford to fix her properly. That is the whole rule. No timer, because
   being told to come back in twelve minutes is a punishment for having had a
   bad run, and the game should not punish a player for losing. It cannot be
   abused either — the moment you can afford a real repair the offer is gone,
   and it only ever patches her to FREE_REPAIR_TO rather than sound. */
export const FREE_REPAIR_TO = 0.6;

/* How long a hunting ground stays empty after you clear it. Long enough that
   beating one means something, short enough that "there is always a fight" is
   still true — every region keeps three other fights while this one is quiet. */
export const HUNT_COOLDOWN_MS = 4 * 60 * 1000;

/* And how long a shipping lane stays quiet after a convoy is taken. Longer
   than a hunt: a convoy is a sailing, not a person, and they do not run one
   the same afternoon you emptied the last. */
export const CONVOY_COOLDOWN_MS = 7 * 60 * 1000;

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
