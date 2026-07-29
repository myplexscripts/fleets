/* How hard a patch of water is, and who is working it.

   Every fight in the game is drawn from one number: the water's RATING. The
   rating comes from where you are, how bad that lane has got, and how badly the
   navy wants you — never from how strong your fleet is. Out-sailing a region is
   supposed to be real and visible; a rating that chased the player would make
   the Caribbean exactly as dangerous on hour nine as on hour one, which is the
   same as having no map at all.

   What the rating does NOT do is decide the fight on its own. Enemies are drawn
   from a BAND around it:

     stragglers   20%   65-80%    easy money, and they still carry cargo
     the water    55%   90-110%   the fight this lane is rated for
     heavies      20%   130-160%  a real risk; you are allowed to walk away
     hunters       5%   180-210%  named, dangerous, and carrying a chest

   That band is the whole answer to "there should be weaker and stronger enemies
   than the player". A rating alone gives one difficulty; a band gives a spread,
   and the spread is where the stories come from — the day three schooners
   jumped you in home water and the day a Man o' War did.

   Rewards are keyed to the RATING, never to what was drawn. Otherwise the
   optimal play would be to fish for stragglers, and fishing is not a game. */

/* What a region's water is rated at before danger and heat touch it. Tuned
   against the fleet a player can realistically field on arrival:

     Caribbean  ~74 power (starting fleet)
     Gulf      ~103        (flagship coming along, a captured frigate)
     Atlantic  ~132
     Grand     ~165        (~194 fully maxed, which is the ceiling)

   The expected draw sits a little under that, so the fight this water is rated
   for is one you should win — and the heavy tail is one you might not. */
export const REGION_RATING = {
  caribbean: 40,
  gulf:      61,
  atlantic:  78,
  grand:     103
};

/* Danger and heat each make the water worse, multiplicatively. Three danger
   steps and three heat steps together take a lane to 1.56x its base — which is
   the difference between a quiet run and the worst night of your life, without
   needing a fourth number anywhere on screen. */
export const DANGER_MULT = 0.18;
export const HEAT_MULT   = 0.10;

/* The band. `share` must total 1. */
export const BANDS = [
  { key: 'straggler', share: 0.20, lo: 0.65, hi: 0.80, n: 'Stragglers' },
  { key: 'rated',     share: 0.55, lo: 0.90, hi: 1.10, n: '' },
  { key: 'heavy',     share: 0.20, lo: 1.30, hi: 1.60, n: 'Heavy' },
  { key: 'hunter',    share: 0.05, lo: 1.80, hi: 2.10, n: 'Hunters' }
];

/* Which bands are carrying something worth taking off the captain personally.
   A chest is the reward for beating the fight you could have declined. */
export const CHEST_BANDS = ['heavy', 'hunter'];

/* The ship ladder, and the rating at which each class starts turning up.

   Spread deliberately: brigs from late Caribbean, frigates from mid Gulf, Man o'
   Wars from mid Atlantic. The old curve did not field a Man o' War until the
   Grand Fleet Route, which handed the player the best hull in the game at the
   exact moment there was nothing left to use it on. */
export const LADDER = [
  { type: 'schooner', from: 0 },
  { type: 'brig',     from: 40 },
  { type: 'frigate',  from: 75 },
  { type: 'manowar',  from: 120 }
];

/* Enemy names, by how much they outclass their water. A hunter is somebody. */
export const HUNTER_NAMES = [
  'Blackwall', 'The Cormorant', 'Iron Kate', 'Saint Elmo', 'The Reckoning',
  'Gallows Wind', 'The Pale Horse', 'Marisol', 'Deadman\'s Purse', 'The Verdict'
];
