/* Onboarding script.

   Each step either shows a modal card (`modal: 1`) or rings a target element
   (`sel`, a CSS selector) and waits for a game event (`wait`) or a button tap
   (`btn`). `lockTab` keeps the player on one screen for that step; `when` names
   a precondition predicate resolved in ui/tutorial.js. */

export const TUTSTEPS = [
  { modal: 1, title: 'Welcome Aboard, Captain',
    text: 'You have inherited a flagship, three worn-out ships, 500 reales and a chart of the Caribbean. Turn that into the most feared fleet on the ocean.',
    btn: 'Begin' },

  { sel: '#main .card', lockTab: 'fleet', title: 'Your Ships',
    text: 'This is Port, where your ships live. Each ship has four numbers: Speed, Guns, Hull and Cargo. Hull is health — drop it to zero and the ship is crippled until you pay to repair it here.',
    btn: 'Next' },

  { sel: '#tabRoutes', lockTab: 'routes', title: 'The Naval Map',
    text: 'Every reale you earn comes from the lanes on the map. Open the Map.',
    wait: 'tab:routes' },

  { sel: '#node_c1', lockTab: 'routes', title: 'A Shipping Lane',
    text: 'Green markers are safe lanes. The one near home port is the Havana to Nassau crossing. Tap it.',
    wait: 'route:c1' },

  { modal: 1, title: 'Two Ways to Sail',
    text: 'Each lane can be played two ways. ATTACK starts a battle immediately, and winning makes the lane safer. TRADE sends ships away for several real minutes to earn money, but they cannot fight while gone — and traders refuse to sail a lane that is still dangerous. So: attack first, trade afterwards.',
    btn: 'Understood' },

  { sel: '#shipPicks', lockTab: 'routes', title: 'Form Your Line',
    text: 'Tap two ships. Order matters: the first fires first, the second deals 25% more damage, the third takes 25% less damage.',
    wait: 'ships:2' },

  { sel: '#sailBtn', lockTab: 'routes', title: 'Clear the Lane',
    text: "Attack. Winning raises this lane's security, which lowers its danger rating.",
    wait: 'launch' },

  { modal: 1, when: 'battle', title: 'Broadsides',
    text: 'Tap an enemy to target it, then give one order per round. FOCUS FIRE — every ship shoots your target. SPREAD FIRE — each ship picks its own. FIRE BARRELS — 60% more damage, limited supply. BRACE — halves damage taken and dealt. BOARD — capture a ship once it is below 40% hull. On a keyboard, the number keys give the same orders.',
    btn: 'To Arms' },

  { sel: '#bcmds', when: 'battle', title: 'Send Them Under',
    text: 'Sink them. Keep using Focus Fire on your target until it goes down.',
    wait: 'battle:end' },

  { sel: '#cap0', when: 'prize', title: 'Prizes of War',
    text: 'A beaten ship is a choice. KEEP adds it to your fleet, but only if you have a free berth — right now you do not. SCRAP breaks it up for parts and a gem. RANSOM sells the crew for reales.',
    wait: ['prize', 'sheet:close'] },

  { sel: '#tabRoutes', lockTab: 'routes', title: 'Now Trade It',
    text: 'The lane is clear, so traders will sail it now. Open the Map and tap that crossing again.',
    wait: 'route:c1' },

  { sel: '#modeVoy', lockTab: 'routes', title: 'Send a Trade Run',
    text: 'Switch to the TRADE tab, pick a ship with cargo space, and send it. It will be gone for a few real minutes and cannot fight until it returns.',
    wait: ['voyage:launch', 'sheet:close'] },

  { sel: '#tabVoy', lockTab: 'voy', title: 'Ships at Sea',
    text: 'Everything you have sent out shows here with a countdown. Collect the reward once a fleet docks.',
    wait: 'tab:voy' },

  { sel: '#tabFlag', lockTab: 'flag', title: 'Your Flagship',
    text: 'One ship is permanently yours. Open the Flagship.',
    wait: 'tab:flag' },

  { sel: '#main .hero', lockTab: 'flag', title: 'She Is Yours Alone',
    text: 'Your flagship uses no berth, cannot be scuttled, and is the only ship you can upgrade. Spend reales and parts on its hull, guns, rigging and hold, and add fittings that change how battles work. Admirals will only fight your flagship.',
    btn: 'Next' },

  { modal: 1, title: 'Charters, Notoriety and Admirals',
    text: "Gold stars are CHARTERS — one-off jobs that permanently open a new port and often award a relic. Everything you finish raises NOTORIETY in that region; fill the bar and the region's admiral sails out to fight you. Beat the admiral and the next region of the map unlocks. Two warnings: lane security decays over time, so a lane you cleared an hour ago may be dangerous again — and the ship's wheel at the top left is your pause menu, where the sound and the rest of it live.",
    btn: 'Start Playing' }
];
