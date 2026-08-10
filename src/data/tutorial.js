/* Onboarding script.

   Each step either shows a modal card (`modal: 1`) or rings a target element
   (`sel`, a CSS selector) and waits for a game event (`wait`) or a button tap
   (`btn`). `lockTab` keeps the player on one screen; `when` names a precondition
   predicate resolved in ui/tutorial.js; `only` restricts which map node may be
   opened during that step.

   The script teaches the two halves separately, because they are separate: a
   fight first, then a cargo run.

   That order is forced by the one-ship start, not chosen for flavour. A cargo
   run takes your ship away for real minutes, and when the flagship is the only
   ship you own, teaching trade first sent her over the horizon and then asked
   the player to fight with a rail full of AT SEA. Fighting first also puts the
   prize screen — the only source of hulls — in front of the player before
   anything else asks them to spare one.

   Keep every step to one or two short sentences. A tutorial card that has to be
   studied is a card that gets dismissed unread — the screens carry the numbers
   themselves, as chips. */

export const TUTSTEPS = [
  { modal: 1, title: 'Welcome Aboard, Captain',
    text: 'One ship, 500 gold, and an ocean that already has owners. Build the most feared fleet on it.',
    btn: 'Begin' },

  { sel: '#main .listrow', lockTab: 'fleet', title: 'She Is All You Have',
    text: 'Speed, guns, hull, cargo — and at zero hull she is crippled until you repair her here. The docks under her are empty: every other ship you own is one you take off an enemy.',
    btn: 'Next' },

  { sel: '#tabRoutes', lockTab: 'routes', title: 'The Naval Map',
    text: 'Everything happens out there. Open the Map.',
    wait: 'tab:routes' },

  /* `only` on the modal as well as on the step that follows it. A modal does not
     cover the whole chart, so without it the player can open any mission on the
     map while the card is up — which with one hull is how a first session ends
     against something four regions out of its depth. The lock runs for the
     whole block, not just the step that names the node. */
  { modal: 1, only: 'c3', title: 'How You Get a Fleet',
    text: 'Angular markers are fights. Take them for the gold and materials — and for the ships, because beating one is the only way to add a hull to your line.',
    btn: 'Show Me' },

  { sel: '#node_c3', lockTab: 'routes', only: 'c3', title: 'A Patrol',
    text: 'Tap the diamond. This one pushes the whole region a step quieter if you win it.',
    wait: 'route:c3' },

  /* Points at the rail, not at the Attack button. The step is about choosing
     the line, and the card is placed so as not to cover what it points at — so
     aiming it at the button in the footer parked it directly on top of the
     ships the player is being told to pick. */
  { sel: '#shipPicks', lockTab: 'routes', title: 'Form the Line',
    text: 'Up to three, and tap order sets the line: first fires first, second deals +25%, third takes −25%. Tonight she sails alone, and Cancel is always there.',
    wait: 'launch' },

  { modal: 1, when: 'battle', title: 'Broadsides',
    text: 'Every ship reloads on her own clock — the bar under each hull — and fires the moment she is loaded. Faster ships fire more often, heavier ones hit harder. Tap a ship to aim your line at her.',
    btn: 'To Arms' },

  { sel: '#bcmds', when: 'battle', title: 'Your Four Choices',
    text: 'Brace to take far less for a few seconds, at the cost of your own rate of fire. Board once she is below 40% to take her whole. Barrels hit hardest of anything you own. Retreat if it turns.',
    wait: 'battle:end' },

  /* Waits for the whole after-action screen to be done, not for the first prize
     to be decided. A won fight can leave two or three hulls to answer for, and
     advancing on the first of them dropped the next step's card straight on top
     of the prize still waiting underneath it.

     The ring follows whichever card is up rather than naming #cap0, because the
     card is renumbered as each prize is settled. */
  { sel: '.prizecard', when: 'prize', title: 'Prizes of War',
    text: 'Each choice shows what it gives you. Keep is how a fleet gets built — it is the only way to add a ship, and it costs you the coin and supplies the other three would have paid.',
    wait: 'sheet:close' },

  { modal: 1, only: 'c1', title: 'Trade Is the Other Half',
    text: 'Routes are always open — you never fight to unlock one. Goods leave your warehouse when she sails, and the contract pays on delivery: gold, and whatever that port had going the other way.',
    btn: 'Understood' },

  { sel: '#node_c1', lockTab: 'routes', only: 'c1', title: 'A Cargo Run',
    text: 'A solid disc is a cargo run. This one wants sugar taken to Nassau, and you have sugar. Tap it.',
    wait: 'route:c1' },

  { sel: '#shipPicks', lockTab: 'routes', title: 'Load the Ship',
    text: 'One ship sails a run, and it rates her on three: cargo, power, speed. Left is what she has, right is what the run wants. Green means she is up to it.',
    wait: 'ships:1' },

  { sel: '#sailBtn', lockTab: 'routes', title: 'Send Her',
    text: 'She will be gone a few real minutes and cannot fight while away — which is the argument for a second hull.',
    wait: 'voyage:launch' },

  { sel: '#tabVoy', lockTab: 'voy', title: 'Ships at Sea',
    text: 'Everything you send out shows here with a countdown. Collect when she docks.',
    wait: 'tab:voy' },

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
