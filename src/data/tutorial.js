/* Onboarding script.

   Each step either shows a modal card (`modal: 1`) or rings a target element
   (`sel`, a CSS selector) and waits for a game event (`wait`) or a button tap
   (`btn`). `lockTab` keeps the player on one screen; `when` names a precondition
   predicate resolved in ui/tutorial.js; `only` restricts which map node may be
   opened during that step.

   The script teaches the two halves separately, because they are separate: a
   cargo run first, then a fight. */

export const TUTSTEPS = [
  { modal: 1, title: 'Welcome Aboard, Captain',
    text: 'You have inherited a flagship, three worn-out ships, 500 gold and a chart of the Caribbean. Turn that into the most feared fleet on the ocean.',
    btn: 'Begin' },

  { sel: '#main .card', lockTab: 'fleet', title: 'Your Ships',
    text: 'This is Port. Each ship has four numbers: Speed, Guns, Hull and Hold. Hull is health — drop it to zero and the ship is crippled until you pay to repair it here. Hold is how much cargo she can carry.',
    btn: 'Next' },

  { sel: '#tabRoutes', lockTab: 'routes', title: 'The Naval Map',
    text: 'Everything you do happens out there. Open the Map.',
    wait: 'tab:routes' },

  { sel: '#node_c1', lockTab: 'routes', only: 'c1', title: 'A Cargo Run',
    text: 'A solid disc is a cargo run — a delivery, not a fight. The one near home port wants sugar taken to Nassau, and you already have sugar in the warehouse. Tap it.',
    wait: 'route:c1' },

  { modal: 1, title: 'How Trade Works',
    text: "A contract names goods, a quantity and a destination, and pays on delivery. The goods come out of your warehouse when the ships leave, so buy what a contract asks for in the Market first. There is no fighting on a cargo run — danger only decides how roughly the fleet is handled on the way. Watch it, though: every lane's danger creeps upward on its own in real time.",
    btn: 'Understood' },

  { sel: '#shipPicks', lockTab: 'routes', title: 'Load the Ships',
    text: 'Pick a ship with enough hold to carry the whole consignment. Up to three can sail together, and their holds add up.',
    wait: 'ships:1' },

  { sel: '#sailBtn', lockTab: 'routes', title: 'Send Them',
    text: 'Load and sail. They will be gone for a few real minutes and cannot fight while away.',
    wait: 'voyage:launch' },

  { sel: '#tabVoy', lockTab: 'voy', title: 'Ships at Sea',
    text: 'Everything you have sent out shows here with a countdown. Collect the payment once a fleet docks.',
    wait: 'tab:voy' },

  { modal: 1, title: 'Fighting Is Its Own Trade',
    text: "You never have to fight to open a trade route — trade routes are always open. Fighting is how you push danger back down. A lane that has drifted above Safe offers a SWEEP on its own sheet: same ships, one battle, one step of danger off that lane. A PATROL is the broad version — it steps every lane in the region down at once and keeps the water quiet for a while. Both also come home with goods taken off the enemy.",
    btn: 'Show Me' },

  { sel: '#node_c3', lockTab: 'routes', only: 'c3', title: 'A Patrol',
    text: 'Open the Map and tap the diamond — the patrol in the Windward Passage. Diamonds, squares and spearheads are all fights.',
    wait: 'route:c3' },

  { sel: '#sailBtn', lockTab: 'routes', title: 'Form the Line',
    text: 'Pick two ships and attack. Order matters: the first fires first, the second deals 25% more damage, the third takes 25% less. The card above shows who is out there and your estimated odds — if a match-up looks bad you can stand off and look again for a different one, as often as you like.',
    wait: 'launch' },

  { modal: 1, when: 'battle', title: 'Broadsides',
    text: 'Tap an enemy to target it, then give one order per round. FOCUS FIRE — every ship shoots your target. SPREAD FIRE — each picks its own. FIRE BARRELS — 60% more damage, limited supply. BRACE — halves damage taken and dealt. BOARD — capture a ship once it is below 40% hull. On a keyboard the number keys give the same orders.',
    btn: 'To Arms' },

  { sel: '#bcmds', when: 'battle', title: 'Send Them Under',
    text: 'Sink them. Keep using Focus Fire on your target until it goes down.',
    wait: 'battle:end' },

  { sel: '#cap0', when: 'prize', title: 'Prizes of War',
    text: 'A beaten ship is a choice. KEEP adds her to your fleet if you have a free berth — right now you do not. BREAK UP strips her for timber, metal and cloth, which is what refits are built from. RANSOM sells the crew back for coin.',
    wait: ['prize', 'sheet:close'] },

  { sel: '#tabFlag', lockTab: 'flag', title: 'Your Flagship',
    text: 'One ship is permanently yours. Open the Flagship.',
    wait: 'tab:flag' },

  { sel: '#main .hero', lockTab: 'flag', title: 'She Is Yours Alone',
    text: 'Your flagship uses no berth, cannot be broken up, and is the only ship you can upgrade. Hull, guns, rigging and hold all cost materials — and each track wants a different one, so keep all three coming in. Her quarters also hold your collection.',
    btn: 'Next' },

  { modal: 1, title: 'Wrecks, Charters and Admirals',
    text: "Rings on the chart are WRECK DIVES: no enemies at all, just depth. Chests come up and sell on the spot, and a better diving bell reaches deeper water and richer wrecks. Gold stars are CHARTERS — one-off jobs that permanently open a new port and often hand over a collectible. Everything you finish raises NOTORIETY in that region; fill the bar and its admiral sails out to fight you. Beat the admiral and the next region unlocks. The ship's wheel at the top left is your pause menu.",
    btn: 'Start Playing' }
];
