/* Upgrade materials.

   Wood, metal and cloth are what refits are actually built from. They come from
   fighting, from breaking up captured hulls, and from diving wrecks — never
   from a contract payout, so a pure trader still has to go and get them. */

export const MATERIALS = {
  wood:  { n: 'Wood',  unit: 'timber', buy: 14 },
  metal: { n: 'Metal', unit: 'ingots', buy: 22 },
  cloth: { n: 'Cloth', unit: 'bolts',  buy: 18 }
};

export const MAT_KEYS = Object.keys(MATERIALS);

/* What breaking up a hull of each class yields. */
export const SCRAP_YIELD = {
  schooner: { wood: 5,  metal: 2,  cloth: 3 },
  brig:     { wood: 8,  metal: 4,  cloth: 5 },
  frigate:  { wood: 13, metal: 8,  cloth: 7 },
  manowar:  { wood: 20, metal: 14, cloth: 10 }
};
