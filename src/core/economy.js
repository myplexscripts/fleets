/* Prices that more than one screen needs to know.

   Kept out of the screens themselves so that moving a thing from one counter to
   another — a dock used to be sold at the market and is now sold in Port — is a
   change of address rather than a change of price. */

import { S } from './state.js';

/* Each dock costs more than the last, so a large fleet is a decision rather
   than something that quietly accumulates. */
export const dockCost = () => ({ gold: 350 + (S.docks - 2) * 250 + (S.docks >= 6 ? 400 : 0) });
