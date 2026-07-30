/* Onboarding script.

   Each step either shows a modal card (`modal: 1`) or rings a target element
   (`sel`, a CSS selector) and waits for a game event (`wait`) or a button tap
   (`btn`). `lockTab` keeps the player on one screen; `when` names a precondition
   predicate resolved in ui/tutorial.js; `only` restricts which map node may be
   opened during that step.

   The script teaches the two halves separately, because they are separate: a
   cargo run first, then a fight.

   Keep every step to one or two short sentences. A tutorial card that has to be
   studied is a card that gets dismissed unread — the screens carry the numbers
   themselves, as chips. */

export const TUTSTEPS = [
  { modal: 1, title: 'Welcome Aboard, Captain',
    text: 'A flagship, three worn-out ships and 500 gold. Make it the most feared fleet on the ocean.',
    btn: 'Begin' },

  { sel: '#main .item', lockTab: 'fleet', title: 'Your Ships',
    text: 'Four numbers each: speed, guns, hull, cargo. At zero hull a ship is crippled until you repair her here.',
    btn: 'Next' },

  { sel: '#tabRoutes', lockTab: 'routes', title: 'The Naval Map',
    text: 'Everything happens out there. Open the Map.',
    wait: 'tab:routes' },

  { sel: '#node_c1', lockTab: 'routes', only: 'c1', title: 'A Cargo Run',
    text: 'A solid disc is a cargo run. This one wants sugar taken to Nassau, and you have sugar. Tap it.',
    wait: 'route:c1' },

  { modal: 1, title: 'How Trade Works',
    text: 'Goods leave your warehouse when the ship sails, and the contract pays on delivery — in gold, and in whatever that port had going the other way. No counter sells cargo: you earn it by running routes and by taking it off the ships you beat.',
    btn: 'Understood' },

  { sel: '#shipPicks', lockTab: 'routes', title: 'Load the Ship',
    text: 'One ship sails a run, and it rates her on three: cargo, power, speed. Left is what she has, right is what the run wants. Green means she is up to it.',
    wait: 'ships:1' },

  { sel: '#sailBtn', lockTab: 'routes', title: 'Send Her',
    text: 'She will be gone a few real minutes and cannot fight while away.',
    wait: 'voyage:launch' },

  { sel: '#tabVoy', lockTab: 'voy', title: 'Ships at Sea',
    text: 'Everything you send out shows here with a countdown. Collect when she docks.',
    wait: 'tab:voy' },

  { modal: 1, title: 'Fighting Is Its Own Trade',
    text: 'You never fight to open a trade route — routes are always open. You fight to push danger back down, and to take gold and materials off the enemy.',
    btn: 'Show Me' },

  { sel: '#node_c3', lockTab: 'routes', only: 'c3', title: 'A Patrol',
    text: 'Open the Map and tap the diamond. Angular markers are fights.',
    wait: 'route:c3' },

  /* Points at the rail, not at the Attack button. The step is about choosing
     the line, and the card is placed so as not to cover what it points at — so
     aiming it at the button in the footer parked it directly on top of the
     ships the player is being told to pick. */
  { sel: '#shipPicks', lockTab: 'routes', title: 'Form the Line',
    text: 'Up to three, and tap order sets the line: first fires first, second deals +25%, third takes −25%. The odds above are a forecast. These are the ships that are out there — if the odds look bad, come back with a better fleet.',
    wait: 'launch' },

  { modal: 1, when: 'battle', title: 'Broadsides',
    text: 'Every ship reloads on her own clock — the bar under each hull — and fires the moment she is loaded. Faster ships fire more often, heavier ones hit harder. Tap a ship to aim your line at her.',
    btn: 'To Arms' },

  { sel: '#bcmds', when: 'battle', title: 'Your Four Choices',
    text: 'Brace to take far less for a few seconds, at the cost of your own rate of fire. Board once she is below 40% to take her whole. Barrels hit hardest of anything you own. Retreat if it turns.',
    wait: 'battle:end' },

  { sel: '#cap0', when: 'prize', title: 'Prizes of War',
    text: 'Each choice shows what it gives you. Keep needs a free dock — and capturing is the only way to add a ship, so docks are worth having.',
    wait: ['prize', 'sheet:close'] },

  { sel: '#tabFlag', lockTab: 'flag', title: 'Your Flagship',
    text: 'One ship is permanently yours. Open the Flagship.',
    wait: 'tab:flag' },

  { sel: '#main .hero', lockTab: 'flag', title: 'She Is Yours Alone',
    text: 'Uses no dock, cannot be scuttled, and is the only ship you can upgrade. Each upgrade track eats a different material.',
    btn: 'Next' },

  { modal: 1, title: 'Wrecks, Charters and Admirals',
    text: 'Rings are wreck dives — no enemies, only depth, and a better bell reaches deeper. Stars are charters, which open ports for good. Everything you finish raises notoriety; fill a region’s bar and its admiral sails out. Beat her and the next region unlocks.',
    btn: 'Start Playing' }
];
