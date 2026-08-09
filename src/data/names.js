/* Every name in the game that belongs to a ship.

   These used to be three short flat lists — twenty player names, twelve enemy
   names, ten hunters — which meant the same dozen hulls turned up all evening
   and a captured brig was renamed to something off the same list she was
   already on. Names are cheap and they are most of what makes a fight
   memorable, so there are a lot of them now and they are sorted the way the
   world is sorted:

     by CLASS, because a sloop called The Hellbound Colossus is a joke, and
     by FACTION, because who you are fighting is the story of the fight.

   A line of enemies draws all its names from ONE faction. "HMS Bulldog and
   HMS Valiant" reads as the navy coming for you; the same two hulls called
   "Gallows Wind" and "The Bone Collector" read as pirates. Mixing them reads
   as neither. */

/* ---- fighting ships ----
   Keyed by the class the hull actually is, so the name always fits the ship. */
export const SHIP_NAMES = {
  schooner: {
    pirate: ["Widow's Whisper", 'The Salt Wren', 'Black Minnow', 'The Sea Fox',
      'Rumrunner', 'The Crooked Compass', "Smuggler's Grace", 'The Tide Thief',
      'Lucky Scoundrel', 'The Scarlet Moth', 'The Wandering Knife',
      'The Restless Pearl', 'The Copper Wasp', 'The Laughing Eel', 'The Nimble Jack'],
    navy: ['HMS Swift', 'HMS Kingfisher', 'HMS Sparrow', 'HMS Vigilant', 'HMS Resolute',
      'HMS Greyhound', 'HMS Providence', 'HMS Diligence', 'HMS Dispatch', 'HMS Seaflower',
      'HMS Alert', 'HMS Endeavour', 'HMS Hawke', 'HMS Mermaid', 'HMS Loyalist']
  },
  brig: {
    pirate: ['The Iron Vulture', 'Gallows Wind', 'The Bloody Lantern', "Rogue's Revenge",
      'The Ashen Serpent', 'The Wicked Promise', "Dead Man's Glory", 'The Red Corsair',
      "Hangman's Pride", "Queen's Betrayal", 'The Bone Collector', 'The Sable Wolf',
      'The Plunderer', 'Cutlass Rose', 'The Howling Devil'],
    navy: ['HMS Defiance', 'HMS Avenger', 'HMS Intrepid', 'HMS Guardian', 'HMS Bulldog',
      'HMS Valiant', 'HMS Conqueror', 'HMS Fortitude', 'HMS Sentinel', "HMS Victory's Child",
      'HMS Thunderer', 'HMS Lionheart', 'HMS Royal Oak', 'HMS Courageous', 'HMS Dauntless']
  },
  frigate: {
    pirate: ['The Black Duchess', 'Crown Breaker', 'The Vengeful Tempest',
      'The Scarlet Reaper', 'The Iron Maiden', "The King's Ransom", 'The Drowned Saint',
      'The Crimson Fortune', "The Devil's Covenant", 'The Gilded Tyrant',
      "The Widow's Fury", 'The Sea Butcher', 'The Broken Crown', 'The Black Reliquary',
      'The Merciless Queen'],
    navy: ['HMS Sovereign', 'HMS Indomitable', 'HMS Britannia', 'HMS Imperial',
      'HMS Gallant', 'HMS Invincible', 'HMS Majestic', 'HMS Triumph', 'HMS Renown',
      'HMS Justice', 'HMS Protector', 'HMS Vanguard', 'HMS Royal George', 'HMS Dominion',
      'HMS Honour']
  },
  manowar: {
    pirate: ['The Tyrant of Tides', 'The Black Leviathan', "The Devil's Dominion",
      'The Crimson Emperor', 'The Dread Sovereign', 'The Ruin of Kings',
      'The Burning Crown', 'The Sea Wraith', 'The Hellbound Colossus',
      "The Queen's Nightmare", 'The Harbinger', 'The Iron Behemoth',
      'The Last Judgement', 'The Grave of Empires', "The World's End"],
    navy: ['HMS Royal Sovereign', 'HMS Crown Imperial', 'HMS Saint George', 'HMS Monarch',
      "HMS King's Glory", 'HMS Britannic Majesty', 'HMS Royal Lion', 'HMS Prince Regent',
      'HMS Empire', 'HMS Duke of Albion', 'HMS Victory', 'HMS Royal Standard',
      'HMS Indefatigable', 'HMS Defender of the Realm', "HMS Majesty's Thunder"]
  }
};

export const FACTIONS = ['pirate', 'navy'];

/* ---- merchants ----
   What you escort, and what a convoy is carrying. Nobody names a trader after
   a weapon; every one of these is about money or the weather. */
export const MERCHANT_NAMES = {
  schooner: ['The Honest Penny', 'The Amber Gull', 'The Silver Sprat', 'The Merry Finch',
    'The Blue Lantern', 'The Gentle Current', 'The Wandering Dove', 'The Coastal Rose',
    'The Salted Apple', 'The Lucky Kestrel', 'The Morning Star', 'The Green Parrot',
    'The Patient Gull', 'The Sunlit Pearl', 'The Fairweather', 'The Humble Fortune',
    'The Penny Royal', 'The Dancing Marlin', 'The Kindly Wind', 'The Wayfarer'],
  brig: ['The Golden Venture', 'The Merchant Prince', 'The Prosperous Maid',
    'The Copper Crown', 'The Golden Harvest', 'The Faithful Trader', "The Fortune's Promise",
    'The Ivory Maiden', 'The Honest Endeavour', 'The Abundant Grace', 'The Spice Runner',
    'The Sapphire Venture', 'The Silver Caravan', 'The Golden Measure', 'The Portly Duchess',
    'The Sugar Crown', 'The Crimson Ledger', 'The Eastern Promise', 'The Prosperity',
    "The Merchant's Grace"],
  frigate: ['The Grand Providence', 'The Crowned Compass', 'The Eastern Sovereign',
    'The Imperial Fortune', 'The Royal Exchange', "The Queen's Bounty",
    'The Gilded Dominion', 'The Western Majesty', "The King's Prosperity",
    'The Oceanic Treasury', "The Merchant's Triumph", "The Governor's Fortune",
    'The Colonial Queen', "The Sovereign's Gift", 'The Wealth of Nations',
    "The Lord Admiral's Prize", 'The Grand Mercantile', "The Company's Honour",
    'The Golden Commonwealth', 'The Boundless Fortune']
};
/* A merchantman big enough to be worth a frigate's name is still a frigate. */
MERCHANT_NAMES.manowar = MERCHANT_NAMES.frigate;

/* ---- bounty hunters ----
   A person and her ship, always together — she is the only enemy in the game
   with a name of her own, so the pair is the unit. */
export const HUNTERS = [
  { captain: 'Captain Silas Crowe', ship: 'The Black Warrant' },
  { captain: 'Captain Eliza Harrow', ship: 'The Relentless' },
  { captain: 'Captain Gideon Flint', ship: "The King's Hound" },
  { captain: 'Captain Mercy Vane', ship: 'The Final Notice' },
  { captain: 'Captain Tobias Rook', ship: 'The Iron Pursuit' },
  { captain: 'Captain Adelaide Graves', ship: 'The Scarlet Writ' },
  { captain: 'Captain Nathaniel Pike', ship: "The Hunter's Due" },
  { captain: 'Captain Beatrice Wolfe', ship: 'The Grey Jackal' },
  { captain: 'Captain Josiah Kane', ship: 'The Reckoning' },
  { captain: 'Captain Mara Thorne', ship: "The Widow's Justice" },
  { captain: 'Captain Ezekiel Stroud', ship: 'The Gallows Ledger' },
  { captain: 'Captain Rosalind Drake', ship: 'The Crimson Verdict' },
  { captain: 'Captain Amos Cutter', ship: 'The Noose Wind' },
  { captain: 'Captain Helena Blackwood', ship: "The Sovereign's Fang" },
  { captain: 'Captain Jasper Creed', ship: 'The Last Appeal' },
  { captain: 'Captain Temperance Shaw', ship: 'The Unforgiven' },
  { captain: 'Captain Barnabas Locke', ship: 'The Iron Summons' },
  { captain: 'Captain Cordelia Vale', ship: 'The Silent Warrant' },
  { captain: 'Captain Elias Mercer', ship: 'The Dead Reckoning' },
  { captain: 'Captain Constance Rooke', ship: "The Crown's Vengeance" },
  { captain: 'Captain Solomon Graves', ship: "The Bounty's End" },
  { captain: 'Captain Agnes Flint', ship: 'The Hanged Man' },
  { captain: 'Captain Thaddeus Wolfe', ship: 'The Bloodhound' },
  { captain: 'Captain Rebecca Harrow', ship: "The Queen's Justice" },
  { captain: 'Captain Malachi Crow', ship: 'The Long Pursuit' },
  { captain: 'Captain Prudence Voss', ship: 'The Cold Verdict' },
  { captain: 'Captain Jeremiah Slade', ship: 'The Wanted Man' },
  { captain: 'Captain Victoria Kane', ship: 'The Black Decree' },
  { captain: 'Captain Isaac Thorne', ship: 'The Last Warning' },
  { captain: 'Captain Eleanor Pike', ship: "The Hunter's Mercy" },
  /* The ones who have been at it long enough to have earned a nickname. These
     are the same job done by people the docks talk about. */
  { captain: '"One Eye" Abel Crowe', ship: 'The Blind Justice' },
  { captain: '"Red Mercy" Marianne Vane', ship: 'The Mercyless' },
  { captain: '"Hangman" Hector Graves', ship: 'The Short Rope' },
  { captain: '"Iron Jack" Silas Kane', ship: 'The Iron Collar' },
  { captain: '"Black Bess" Elizabeth Wolfe', ship: "The Devil's Bailiff" },
  { captain: '"Deadshot" Tobias Flint', ship: 'The Sure Aim' },
  { captain: '"Cold Hand" Amos Rook', ship: 'The Frozen Writ' },
  { captain: '"The Magistrate" Gideon Shaw', ship: 'The Final Sentence' },
  { captain: '"Bloodhound" Barnabas Pike', ship: 'The Scent of Gold' },
  { captain: '"Quiet Mary" Mary Thorne', ship: 'The Silent Gallows' },
  { captain: '"Silver Tongue" Elias Vale', ship: 'The False Promise' },
  { captain: '"Old Noose" Jeremiah Crow', ship: 'The Hanging Judge' },
  { captain: '"The Widowmaker" Constance Black', ship: 'The Mourning Bell' },
  { captain: '"Grim Tom" Thomas Slade', ship: 'The Grave Pursuit' },
  { captain: '"The Collector" Nathaniel Locke', ship: 'The Debt Repaid' }
];

/* ---- wrecks ----
   What is lying on the bottom, by who she was. Sorted by faction because a
   region's wrecks say what happened in that water: the Caribbean is full of
   dead pirates, the Grand Fleet Route is where empires went down. */
export const WRECK_NAMES = {
  pirate: ['The Drowned Marauder', "Black Jack's Folly", 'The Broken Cutlass',
    'The Dead Corsair', 'The Sunken Scoundrel', "Widow's Ruin", 'The Splintered Skull',
    'The Lost Reaver', 'The Crimson Grave', 'The Devil Below', 'The Last Plunder',
    'Gallows Rest', 'The Shattered Fortune', 'The Saltbound Rogue', 'The Drowned Devil',
    'The Bleeding Wreck', 'The Broken Covenant', "Dead Man's Prize",
    'The Ruin of Red Jack', 'The Sable Remains', "The Pirate's Tomb",
    'The Wretched Crown', 'The Scourge Below', 'The Lost Brigand', 'The Sunken Tyrant',
    'The Barnacled Banshee', "The Depths' Revenge", 'The Forsaken Raider',
    'The Blackened Hull', 'The Final Mutiny'],
  navy: ['The Fallen Sovereign', 'The Lost Vanguard', "His Majesty's Grave",
    'The Broken Standard', 'The Sunken Lion', "The King's Misfortune",
    'The Drowned Admiral', "The Crown's Lament", 'The Last Salute', 'The Ruin of Honour',
    'The Fallen Majesty', 'The Royal Remains', 'The Splintered Victory',
    'The Lost Defender', 'The Sovereign Below', "The Admiral's Folly",
    "The King's Regret", 'The Silent Broadside', 'The Broken Britannia',
    'The Drowned Sentinel', 'The Crown Beneath', 'The Vanquished', 'The Final Colours',
    'The Lost Indomitable', 'The Sunken Regiment', 'The Iron Grave', 'The Royal Tomb',
    'The Wreck of Saint George', 'The Fallen Guardian', "The King's Last Ship"],
  merchant: ['The Lost Fortune', 'The Sunken Ledger', "The Merchant's Folly",
    'The Drowned Penny', 'The Broken Venture', 'The Golden Grave', 'The Spice Wreck',
    'The Lost Caravan', 'The Silver Below', 'The Ruined Harvest', "The Trader's Rest",
    'The Sunken Exchange', 'The Amber Wreck', 'The Broken Compass',
    "The Merchant's Lament", 'The Drowned Cargo', 'The Lost Providence',
    'The Copper Grave', 'The Shattered Bounty', 'The Empty Hold',
    'The Sunken Treasury', 'The Ruin of Prosperity', 'The Golden Misfortune',
    'The Last Shipment', 'The Salted Fortune', 'The Broken Measure', 'The Lost Company',
    "The Wayfarer's End", 'The Gilded Wreck', 'The Merchant Below'],
  hunter: ['The Final Warrant', "The Hunter's Grave", 'The Broken Verdict',
    'The Lost Bloodhound', 'The Sunken Pursuit', 'The Last Sentence',
    'The Drowned Bailiff', 'The Hunter Below', 'The Black Decree',
    'The Shattered Summons', 'The Iron Wreck', 'The Gallows Debt',
    "The Collector's End", 'The Failed Reckoning', 'The Silent Writ',
    'The Lost Magistrate', 'The Broken Noose', 'The Final Appeal',
    'The Sunken Justice', "The Hunter's Folly", 'The Cold Grave',
    "The Crown's Lost Hound", 'The Last Bounty', 'The Drowned Warrant',
    'The Wanted Wreck', 'The Ruined Pursuit', 'The Unpaid Debt',
    "The Black Warrant's Rest", 'The Fallen Tracker', 'The Dead Reckoning'],
  /* Places rather than ships — a whole fleet went down here, or enough of one
     that the reef is named for it. The deepest water gets these. */
  legendary: ["Leviathan's Grave", 'The Graveyard of Kings', "Dead Man's Reef",
    'The Wrecking Shoals', "Siren's Rest", 'The Blackwater Grave',
    'The Splintered Fleet', 'Widowmaker Reef', 'The Drowned Kingdom',
    "The Devil's Anchorage", 'The Reef of Bones', "The Sailor's Tomb",
    'The Lost Armada', 'The Iron Depths', 'The Sea of Masts', 'The Sunken Court',
    "The Captain's Graveyard", 'The Bleached Fleet', 'The Broken Passage',
    'The Grave Tide', 'The Drowned Crown', "The Wreckers' Reach", "The Sailor's End",
    'The Silent Harbour', 'The Reef of Lost Souls', 'The Dead Fleet',
    'The Shattered Coast', 'The Maw Below', 'The Sunken Horizon', 'The Grave of Empires']
};

/* Which wrecks a region's water is full of. Reads as history: home water is
   where small-time pirates died, and the Grand Fleet Route is where the
   line-of-battle ships did. */
export const REGION_WRECKS = {
  caribbean: ['pirate', 'merchant'],
  gulf:      ['merchant', 'pirate'],
  atlantic:  ['navy', 'hunter'],
  grand:     ['legendary', 'navy']
};
