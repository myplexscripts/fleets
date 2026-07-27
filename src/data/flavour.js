/* Battle-log flavour banks. %s = ship name, %d = damage.

   The log floats over the water rather than sitting in a band of its own, so
   every line it wraps onto is a line of the battle it covers. These are written
   to fit one row on a phone: a verb, two names, a number. The colour and the
   number carry the information; the verb only has to keep it from reading like
   a spreadsheet. */

export const HIT_P = [
  '%s rakes %s for %d.',
  '%s puts a broadside into %s — %d.',
  '%s hammers %s for %d.',
  '%s finds the range on %s — %d.',
  "%s's gunners bite into %s for %d.",
  '%s comes about and opens up on %s — %d.'
];

export const HIT_E = [
  '%s answers — %s takes %d.',
  '%s finds your line. %s: %d.',
  'A ragged volley from %s. %s loses %d.',
  '%s will not be ignored — %s takes %d.',
  '%s crosses your wake and rakes %s for %d.'
];

export const SINK = [
  '%s settles by the head. Finished.',
  '%s loses her mainmast and goes silent.',
  '%s burns where she sits.',
  '%s rolls over and shows her keel.',
  'The fight goes out of %s all at once.'
];

export const CRIP = [
  '%s is holed below the waterline.',
  '%s drifts, crippled.',
  "They have gutted %s. Her guns fall silent."
];

/* Shown under the wordmark on the title screen. Room to breathe here. */
export const TITLE_LINES = [
  'Every lane you clear goes dangerous again by morning.',
  'The ocean does not care how many guns you own.',
  'Four admirals. One of them is already looking for you.',
  'A ship at sea earns nothing and defends nothing.',
  'Salt in the rigging, powder in the hold.'
];
