/* Wreck diving.

   Dives carry no risk of a fight — nobody is guarding a wreck. What gates them
   is depth: every site sits at a depth, and you cannot work one your bell cannot
   reach. Bell tiers are the thing a diving captain builds toward, the way gun
   decks are the thing a fighting captain builds toward.

   Chests come up and are sold on the spot. The player never holds one. */

export const MAX_BELL = 4;

export const BELL_NAMES = [
  'No Diving Bell',
  'Iron Hoop Bell',
  'Sheathed Oak Bell',
  'Copper Diving Bell',
  'Pressurised Bell'
];

/* Cost to go from tier `b` to `b + 1`. */
export function bellCost(b) {
  return {
    reales: 500 * (b + 1),
    metal: 14 * (b + 1),
    wood: 8 * (b + 1),
    cloth: 4 * (b + 1),
    gems: b >= 2 ? b - 1 : 0
  };
}

/* Tier 0 can still work the shallows. */
export const bellMaxDepth = b => b + 1;

export const DEPTH_NAMES = ['', 'Shallows', 'Reef Shelf', 'Deep Water', 'The Trench', 'The Abyss'];

/* Reales per chest, by depth. Deep water is where the money is. */
export const CHEST_VALUE = [0, 90, 170, 320, 620, 1150];

/* Chance a dive turns up a collectible piece, by depth. */
export const DIVE_FIND_CHANCE = [0, 0.14, 0.20, 0.27, 0.35, 0.45];
