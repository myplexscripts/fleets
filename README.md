# Salt & Powder

A fleet-command game set in the age of sail. Three things to do, and they are
kept separate on purpose:

- **Cargo runs** — deliver X of a good to port Z, get paid. No fighting. A run
  sails under **one ship** and rates her on three counts: **cargo** to carry the
  consignment, **power** to see off the water she crosses, **speed** to make the
  passage. Only cargo is a hard gate; short on power costs you odds, short on
  speed costs you hours. She comes home with coin *and* whatever that port had
  going the other way, which is what keeps trade self-sustaining.
- **Wreck dives** — send divers down; chests come up and sell on the quay. No
  enemies either, only depth, and depth is what your diving bell is for. Also one
  ship: her cargo space caps how many chests can come up in a trip.
- **Battles** — patrols, escorts, raids, blockades, charters and admirals. A line
  of up to three, and the tap order sets it. These pay in gold, materials, and
  trade goods taken off the enemy — so a captain who runs out of money can fight
  their way back to a full store of timber, metal and cloth.

**Nothing important is for sale.** The market does not stock trade goods and does
not stock ships: cargo comes off the routes you run and the holds you empty, and
a ship joins your fleet only by being taken from someone else. What the market
does is sell the dull stuff — materials, a deeper diving bell, another berth —
and buy your surplus cargo when you want coin instead.

**Danger is alive**, and it has three levels: **Safe, Risky, Hazardous**. Every
cargo lane climbs on its own in real time, at its own rate and up to its own
ceiling — home water drifts slowly and never gets past Risky; the Grand Fleet
Route is Hazardous again within the hour. Danger never blocks trade. It only
decides how roughly a run is handled.

**A bad lane is two jobs, and neither is compulsory.** Its sheet opens on two
tabs: run it as it stands, or fight it and knock a step of danger off first.
Sailing a Hazardous lane anyway is always allowed — danger only decides how
roughly the passage goes. A patrol does the same thing across a whole region at
once.

**You face the ships that are out there.** They are generated from the water
itself — the region's tier and that lane's danger right now — so a lane that has
drifted brings out heavier ships than it did an hour ago. There is no rerolling
for an easier line-up: the answer to a match-up you cannot win is a better fleet,
and a button that reshuffles the opposition is a button that makes building one
pointless. You see the odds before you commit, and walking away is always
allowed.

**The after-action report gets the whole screen**, and the haul is the biggest
thing on it: a strongbox of chips before any words, with the account of the
fight kept to a line or two underneath. You were there — you do not need it
narrated.

**A prize is a decision, not a payout.** Beat a ship and nothing is granted
automatically — keep her and she takes a berth, scuttle her for materials, ransom
the crew, or let her drift. The after-action sheet will not close until every
prize has been answered for, by the button, by Escape or by tapping away. A **patrol** is the broad version: it steps every lane in its
region down at once and keeps the water quiet for a while. A Safe lane offers
nothing to fight, which is the point.

Fill a region's notoriety bar and its admiral comes looking for you. Beat the
admiral and the next region of the chart unlocks. Trade never unlocks anything —
progression runs through notoriety and admirals.

**Read it at a glance.** Anything numeric is a chip: one glyph, one number. Where
a number is a test rather than a reading it is written have/need — the left figure
is what you have, the right is what the job wants, green when you are covered and
red when you are short. So a cargo chip reading `25/25` says this hull can take
the consignment, and `10/25` says it cannot. Speed, guns, hull, cargo, time away,
power, odds, depth and notoriety all read the same way, and **every price in the
game** is written have/need too — repairs, upgrades, fittings, hulls, berths, the
diving bell — so "can I afford this" is never a question you have to work out.

**One layout, everywhere.** `src/ui/components.js` holds the whole vocabulary and
every screen builds from it, so a player learns a shape once. An item card is
always identity → what you hold → what it is → a footer with **the price on the
left and the action on the right**, primary button rightmost. Quantities are
always a **stepper** (`− 3 +`) and never a row of preset buttons. A set of things
you choose between is a **rail** that scrolls sideways, so it can't push what you
are checking off the screen. What a job requires goes in a **requirement bar** in
the sheet head, where it cannot scroll away — and the button that commits it sits
in the panel foot, where it also cannot.

**Panels are full screens, never drawers.** Mission, stores and the after-action
report all use the same three bands — **head** states what you are looking at
and what it asks for, **body** scrolls, **foot** holds the button — so nothing
numeric ever appears below the fold on one screen and above it on another. A
sheet leaves a strip of the screen behind it that is neither useful nor
tappable; it just makes the thing you came to look at smaller.

**A group of amounts is tiles, not chips.** Glyph over number, on a fixed grid,
so a haul fits one row and the yield of one choice lines up with the yield of
the next. Chips are for a number inside a sentence. The rules are written at the top of that
module; the fix for something that doesn't fit is to change a rule, not to invent
a style in a screen.

**The chart's key names every symbol on it.** One shape per mission type, no
sharing, and the key lists exactly the shapes currently drawn — so it grows an
Admiral entry the moment she sails and can never leave a shape unexplained.

**No text below 16px and no icon below 40px, ever.** Screens carry numbers, not
paragraphs: a mission tip is one clause, an upgrade says `+10` and its price, and
an empty screen says "No ships at sea." rather than explaining what a ship is
for.

Vanilla JavaScript ES modules, no build step, no runtime dependencies beyond a
vendored copy of [Phaser 3](https://phaser.io/) for the battle renderer.

## Running it

ES modules need a real HTTP origin — opening `index.html` from the filesystem
will not work. Any static server does:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Deploying is a straight static upload: the repository root *is* the site.

## Controls

| Input | Action |
| --- | --- |
| `1`–`5` | Switch screen (Port, Flagship, Map, At Sea, Market) |
| `Esc` / `P` | Pause & options |
| `Esc` | Close a sheet or dialog |
| `Enter` | Confirm the focused action (sail, continue, dialog) |
| `1`–`6` in battle | Give that order |
| `←` `→` / `Tab` in battle | Change target |

Everything is reachable by touch or mouse as well.

## Layout

```
index.html            markup shell only — no logic, no inline handlers
vendor/phaser.min.js  pinned Phaser 3.90.0 (arcade build, no Matter)
fonts/                self-hosted woff2 subsets
styles/
  fonts.css           @font-face declarations
  base.css            reset, design tokens, typography, chips
  components.css      how the shared vocabulary looks
  hud.css             top bar, resource plates, nav rail
  screens.css         port, flagship hero, relics, chart
  battle.css          battle view
  overlays.css        sheet, dialogs, pause, title, loading, toasts, tutorial
tools/
  check-min-size.js   fails on text under 16px or icons under 40px
  check-overflow.js   fails on any screen that scrolls sideways
  check-map-spacing.js  fails if two markers land closer than a thumb apart
  check-hud.js        the purse, the folding key, the live countdown
src/
  main.js             boot sequence
  core/
    config.js         every tuning number
    state.js          the save object, migrations, persistence
    contracts.js      per-port cargo contracts (drawn, stored, redrawn)
    selectors.js      derived facts (power, danger, voyages) — pure reads. Also
                      owns live lane danger: stored as (step, timestamp) and
                      projected forward on read, so lanes keep drifting while
                      the game is closed with no ticker running
    settings.js       player options, stored separately from the save
    actions.js        data-act click delegation
    bus.js            tiny event bus, used to keep imports acyclic
    dom.js  rng.js    helpers
  data/               pure content: ships, routes, ports, charters, bosses,
                      goods, materials, salvage/bell tables, collectible sets,
                      flagship upgrades, flavour text, tutorial script
  art/                procedural ship sprites and icons (SVG → canvas)
  fx/                 sound, toasts, awards, pops, transitions, coins, haptics
  systems/            voyages (cargo + dives), notoriety, collectibles, loot,
                      enemy generation, battle outcomes
  ui/
    shell.js          screen router, nav, world ticker
    screens/          one module per screen
    format.js         the chip vocabulary every screen reads numbers through
    result.js         the after-action screen and the prize decisions
    hud.js            the purse: gold, and the way into the stores
    components.js     item cards, steppers, rails, requirement bars — and the
                      rules they must not break
    mission.js        mission sheet and launch
    result.js         after-action report and prizes
    stores.js         Ship's Stores sheet (goods, materials, bell)
    title.js  pause.js  dialog.js  sheet.js  loading.js  tutorial.js  keys.js
  battle/
    state.js          live engagement state
    loop.js           turn loop, orders, rounds
    scene.js          Phaser scene: ships, gunnery, sinking
    hud.js            battle chrome and end banner
```

### Conventions worth knowing

**No inline handlers.** Markup is generated as HTML strings, so buttons carry
`data-act="repair" data-id="s3"` and modules register handlers:

```js
actions({ repair: d => doRepair(d.id) });
```

The registry (`core/actions.js`) means a screen never has to expose globals, and
it works on SVG nodes — which is how the chart's markers are wired.

**Numbers are chips, not prose.** `ui/format.js` owns the vocabulary and every
screen goes through it, so the same quantity looks the same everywhere:

```js
chip('speed', s.speed)          // one glyph, one number
have('cargo', s.cargo, r.qty)   // 25/8 — green when covered, red when short
outOf('hull', s.hull, s.max)    // a level, never red for being full
shipChips(s, extra, need)        // speed, guns, hull, cargo in a fixed order
```

`have` is for a test and `outOf` is for a reading; keeping them apart is what
stops a full hull bar from looking like a failure. `priceChips(cost)` is the one
to reach for on anything the player pays for. Add a glyph to `art/icons.js`
before reaching for a word.

**The size floors are enforced, not remembered.** `tools/check-min-size.js` fails
on any authored `font-size` below 16px — including a `clamp()` minimum, an inverted `clamp()`, or a
relative size with no `max(…)` floor — and on any `iconHTML()` call asking for
fewer than 40 pixels. Run it with plain node for those:

```sh
node tools/check-min-size.js
```

With `playwright-core` on hand and the game being served it also measures what
the browser actually computes, across three viewports and nine surfaces — screens
and overlays alike — which is how a `0.5em` sub-label got caught.

**The chart pans.** It is drawn at whatever scale keeps the two closest markers
96px apart — a thumb — rather than being squeezed into the viewport, so
unlocking a region spreads the map out instead of shrinking every marker on it.
When that is bigger than the screen you drag it. `tools/check-map-spacing.js`
walks three stages of progression, measures the tightest pair, and clicks
markers to prove they are reachable.

**Good news stops the game; small change does not.** A new port, a new region, a
collectible, a refit — anything earned — comes up as a card with the thing drawn
large and a button to take it, because an award that slides past unnoticed is
the moment the whole loop exists to produce. A purchase is the opposite: the
`+20` leaps off the button you just pressed and your eye never leaves it.

**The header carries one number.** Gold, and a door to the Ship's Stores with no
count on it — everything else you own has a screen that says it better, and a row
of running totals above a chart is a spreadsheet header, not a game. It shows on
Port and Market, where money is part of the decision in front of you, and nowhere
else.

**The chart's key folds away.** It is useful until you know it and then it is
covering water, so a button in the corner hides it and the chart takes the room
back. The struck colours of an admiral you have already beaten are named in it
like everything else.

**No scrollbars, and nothing scrolls sideways.** A scrollbar is browser chrome, and browser chrome is
the loudest thing on screen saying "this is a web page". Scrolling works exactly
as before; it just does not draw a track. `tools/check-overflow.js` measures every
screen for horizontal overflow and names the element responsible — that is how a
decorative glow laid out 20% wider than its box got caught.

**The bus exists to break cycles.** `ui/shell.js` owns rendering and imports
every screen, so screens cannot import it back. They call `render()` from
`core/bus.js` instead and shell listens.

**Data is inert.** Nothing in `src/data/` imports anything but other data. New
lanes, ports, charters or admirals are content edits, not code changes.

**Player text is escaped.** Ship names are player-authored and land in
`innerHTML` templates, so they go through `esc()` from `core/dom.js`.

**Assets are optional overrides.** Ship sprites and icons are generated as SVG
at runtime. Drop a PNG at `img/ship_<type>_<palette>.png` or
`img/icon_<name>.png` and it silently replaces the generated one. Same for
audio: every cue has a WebAudio synth fallback, and a file at `audio/<cue>.mp3`
takes over. Neither directory needs to exist.

**Nothing loads from a third party.** Phaser and the fonts are vendored, so the
game boots identically offline. If Phaser somehow fails to load, battles still
resolve through the log rather than taking the whole game down.

## Economy

**Gold** is the only currency. Everything is priced in it and everything pays in
it — there is no premium second currency splitting the same decision in two.

**Trade goods** — sugar, rum, tobacco, wine, spice. Bought at the Market,
**won from any battle**, consumed by cargo contracts, and sellable back at a
loss. A delivery pays several times the counter price for the same crates, so the
market is where you dump stock you cannot place, not a business model. A captain
who fights rarely has to buy stock at all.

**Materials** — wood, metal, cloth. What every refit is built from. They come
from fighting, from breaking up captured hulls, and from wreck dives; contracts
never pay in them. Each flagship upgrade track wants a different mix, so a
captain who only ever fights runs short of cloth and one who only ever trades
runs short of metal.

**Chests** are not an item. A dive lands them and they convert to reales on the
quayside — the player never holds one.

**Collectible sets** accumulate for the life of a save and are never spent. Five
sets are awarded piece by piece by charters; two only ever turn up at sea, off a
wreck or off a beaten ship. Completing one changes nothing mechanically — it
fills a shelf in the great cabin.

## Save data

`localStorage`:

- `saltpowder` — the game. `core/state.js#migrate` upgrades older shapes on
  load, so adding fields is safe. It converts pre-goods saves (the old generic
  `cargo` becomes sugar and rum, `parts` splits into wood/metal/cloth, flat
  `relics` fold into their collectible sets), folds the retired `gems` currency
  into gold at a flat rate, and drops the old lane-security table.
- `sp_settings` — audio, motion, haptics. Survives starting a new game.
- `sp_tutdone` — whether the tutorial has ever been finished.
