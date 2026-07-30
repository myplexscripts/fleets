/* Prices that more than one screen needs to know.

   Kept out of the screens themselves so that moving a thing from one counter to
   another — a dock used to be sold at the market and is now sold in Port — is a
   change of address rather than a change of price. */

import { S } from './state.js';

/* Each dock costs more than the last, so a large fleet is a decision rather
   than something that quietly accumulates — and it compounds, because the fleet
   a dock lets you keep is itself what earns the next one. A linear ramp meant
   the sixth dock cost less than one ransomed frigate. */
export const dockCost = () => ({ gold: Math.round(600 * Math.pow(1.65, Math.max(0, S.docks - 3))) });
