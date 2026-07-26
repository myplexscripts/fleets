/* Region admirals.

   Each has one or more `gimmicks` that the battle loop reads:
     ironclad  — cannot be boarded at all
     wolfpack  — replaces losses from `reinforcements` while `reinforce` lasts
     broadside — every third round it telegraphs, then fires one huge volley */

export const BOSSES = {
  caribbean: {
    id: 'boss_caribbean', region: 'caribbean', n: 'Commodore Vane', title: 'The Ironclad',
    x: 238, y: 406, unlocks: 'gulf', noto: 100, power: 70, gimmicks: ['ironclad'],
    desc: 'Vane sheathed her decks in iron after the last man tried to board her, and the man before that. Grapples find no purchase; hooks skid and fall away. Her guns are light for a ship of that weight — but she does not need heavy guns. She only needs to still be floating when you are not.',
    rew: { gold: 2000, metal: 14, wood: 7, cloth: 5 },
    ships: [
      { type: 'manowar', name: 'HMS Bulwark',    hull: 130, guns: 7, speed: 2, isBoss: 1 },
      { type: 'brig',    name: 'HMS Tenacious',  hull: 46,  guns: 6, speed: 5 }
    ]
  },
  gulf: {
    id: 'boss_gulf', region: 'gulf', n: 'Almirante Sombra', title: 'The Wolfpack',
    x: 14, y: 150, unlocks: 'atlantic', noto: 140, power: 130, gimmicks: ['wolfpack'], reinforce: 2,
    desc: 'Sombra does not fight alone and never has. Send one of her wolves to the bottom and another slides out of the fog before the water has closed over the first. Pouring everything into a single target is how captains die here — spread your fire and finish it fast.',
    rew: { gold: 3400, metal: 18, wood: 9, cloth: 7 },
    ships: [
      { type: 'brig',     name: 'Lobo Negro',     hull: 56, guns: 10, speed: 8, isBoss: 1 },
      { type: 'brig',     name: 'Sombra Segunda', hull: 48, guns: 9,  speed: 7 },
      { type: 'schooner', name: 'Sombra Tercera', hull: 36, guns: 8,  speed: 9 }
    ],
    reinforcements: [
      { type: 'brig', name: 'Lobo Cuarto', hull: 46, guns: 9, speed: 7 },
      { type: 'brig', name: 'Lobo Quinto', hull: 46, guns: 9, speed: 7 }
    ]
  },
  atlantic: {
    id: 'boss_atlantic', region: 'atlantic', n: 'Lord Ashgrave', title: 'The Broadside',
    x: 344, y: 132, unlocks: 'grand', noto: 180, power: 215, gimmicks: ['broadside'],
    desc: "Every third round Ashgrave has his people roll out the lower deck and put everything he owns into a single volley. You will hear the gunports come up a full round before it lands. Brace when they do, or write a letter to somebody's family.",
    rew: { gold: 5400, metal: 22, wood: 12, cloth: 8 },
    ships: [
      { type: 'manowar', name: 'HMS Cataclysm', hull: 170, guns: 15, speed: 3, isBoss: 1 },
      { type: 'frigate', name: 'HMS Perdition', hull: 74,  guns: 11, speed: 4 },
      { type: 'frigate', name: 'HMS Rampart',   hull: 74,  guns: 11, speed: 4 }
    ]
  },
  grand: {
    id: 'boss_grand', region: 'grand', n: 'The Ghost Fleet', title: 'All Three Curses',
    x: 36, y: 52, unlocks: null, noto: 200, power: 310, final: 1,
    gimmicks: ['ironclad', 'wolfpack', 'broadside'], reinforce: 2,
    desc: 'Barnacled hulls that no grapple will hold. Wolves that rise out of the fog where nothing was. A broadside that splits the sky open. Every lesson this ocean has beaten into you, arriving at once and all together.',
    rew: { gold: 11400, metal: 34, wood: 16, cloth: 12 },
    ships: [
      { type: 'manowar', name: 'The Drowned King', hull: 195, guns: 17, speed: 3, isBoss: 1 },
      { type: 'frigate', name: 'Pale Lantern',     hull: 90,  guns: 14, speed: 5 },
      { type: 'frigate', name: 'Cold Meridian',    hull: 90,  guns: 14, speed: 5 }
    ],
    reinforcements: [
      { type: 'frigate', name: 'Revenant',    hull: 82, guns: 13, speed: 5 },
      { type: 'frigate', name: 'Wake of Ash', hull: 82, guns: 13, speed: 5 }
    ]
  }
};
