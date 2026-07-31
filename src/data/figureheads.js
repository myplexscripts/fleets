/* Figureheads.

   The carving under the bowsprit, and the only thing on the flagship you swap
   rather than accumulate. Every other upgrade in the game is a ratchet — a tier
   bought is a tier owned, and the flagship only ever gets better. That is right
   for a ladder and it means no decision is ever revisited.

   One figurehead at a time. Nothing is lost by changing your mind and nothing
   is gained by hoarding, so the question is only ever "what am I doing this
   afternoon" — running cargo, hunting a bounty, going after an admiral — and
   the answer is a different carving each time.

   Two ways to get one:

     The chandler sells three. They are plain, cheap enough to own all of them
     early, and each does one obvious thing — so the mechanic is understood long
     before anything rare turns up.

     An admiral carries one. Hers is stronger and does something the bought
     ones cannot, and she is the only source of it. Beating all four is the only
     way to hold all four.

   Every effect below is read somewhere real: `fx()` is the one door. Nothing
   reads S.figurehead directly, so adding a carving is adding a line here. */

export const FIGUREHEADS = {
  /* ---- the chandler's stock ---- */
  mermaid: {
    n: 'The Mermaid', sub: 'Painted pine, gilt scales',
    desc: 'Your line reloads a tenth faster.',
    cost: { gold: 1800, wood: 20, cloth: 12 },
    fx: { reload: 0.90 }
  },
  bull: {
    n: 'The Bull', sub: 'Oak, horns picked out in black',
    desc: 'Every shot lands a tenth harder.',
    cost: { gold: 2400, wood: 26, metal: 16 },
    fx: { dmg: 1.10 }
  },
  turtle: {
    n: 'The Turtle', sub: 'Low, broad, and unlovely',
    desc: 'Your hulls take a tenth less.',
    cost: { gold: 2600, wood: 22, metal: 22 },
    fx: { armour: 0.90 }
  },

  /* ---- taken off an admiral ---- */
  vane: {
    n: 'The Hanged Man', sub: "Cut from Commodore Vane's stern",
    desc: 'Ransoms pay half again as much.',
    boss: 'caribbean',
    fx: { ransom: 1.5 }
  },
  sombra: {
    n: 'La Sombra', sub: "Almirante Sombra's own carving",
    desc: 'Board at 55% hull instead of 40%.',
    boss: 'gulf',
    fx: { board: 0.55 }
  },
  ashgrave: {
    n: 'The Grey Lady', sub: 'Lord Ashgrave had her whitened',
    desc: 'Your warehouse holds half again as much.',
    boss: 'atlantic',
    fx: { store: 1.5 }
  },
  ghost: {
    n: 'The Drowned Girl', sub: 'She was on the Ghost Fleet flag',
    desc: 'Your line opens fire already loaded.',
    boss: 'grand',
    fx: { primed: 1 }
  }
};

export const FIG_KEYS = Object.keys(FIGUREHEADS);

/* The ones the chandler stocks, in the order he shows them. */
export const SHOP_FIGS = FIG_KEYS.filter(k => FIGUREHEADS[k].cost);

/* Which carving an admiral gives up. */
export const figForBoss = rk => FIG_KEYS.find(k => FIGUREHEADS[k].boss === rk) || null;
