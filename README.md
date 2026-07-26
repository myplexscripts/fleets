# Salt & Powder

A fleet-command game set in the age of sail. Three things to do, and they are
kept separate on purpose:

- **Cargo runs** — buy goods, deliver X of them to port Z, get paid. No fighting.
- **Wreck dives** — send divers down; chests come up and sell on the quay. No
  enemies either, only depth, and depth is what your diving bell is for.
- **Battles** — patrols, escorts, raids, blockades, charters and admirals. These
  pay in gold, materials, and trade goods taken off the enemy.

**Danger is alive.** Every cargo lane's danger climbs on its own in real time, at
its own rate and up to its own ceiling — home water drifts slowly and never gets
worse than Hazardous; the Grand Fleet Route is Treacherous again within the hour.
Danger never blocks trade. It only decides how roughly a run is handled.

Pushing it back down is the fight you choose to have. A lane above Safe offers a
**sweep** on its own sheet — the same three ships, one battle, one step of danger
off that lane. A **patrol** is the broad version: it steps every lane in its
region down at once and keeps the water quiet for a while. A Safe lane offers
nothing to fight, which is the point.

Before any battle you see who is out there and your **estimated odds**, and you
can stand off and look again for a different line-up as often as you like.

Fill a region's notoriety bar and its admiral comes looking for you. Beat the
admiral and the next region of the chart unlocks. Trade never unlocks anything —
progression runs through notoriety and admirals.

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
  base.css            reset, design tokens, typography, shared components
  hud.css             top bar, resource plates, nav rail
  screens.css         port, flagship hero, relics, chart
  battle.css          battle view
  overlays.css        sheet, dialogs, pause, title, loading, toasts, tutorial
src/
  main.js             boot sequence
  core/
    config.js         every tuning number
    state.js          the save object, migrations, persistence
    contracts.js      per-port cargo contracts (drawn, stored, redrawn)
    selectors.js      also owns live lane danger: stored as (step, timestamp)
                      and projected forward on read, so lanes keep drifting
                      while the game is closed with no ticker running
    selectors.js      derived facts (power, danger, voyages) — pure reads
    settings.js       player options, stored separately from the save
    actions.js        data-act click delegation
    bus.js            tiny event bus, used to keep imports acyclic
    dom.js  rng.js    helpers
  data/               pure content: ships, routes, ports, charters, bosses,
                      goods, materials, salvage/bell tables, collectible sets,
                      flagship upgrades, flavour text, tutorial script
  art/                procedural ship sprites and icons (SVG → canvas)
  fx/                 sound, toasts, transitions, coins, mist, haptics
  systems/            voyages (cargo + dives), notoriety, collectibles, loot,
                      enemy generation, battle outcomes (including lane sweeps)
  ui/
    shell.js          screen router, nav, world ticker
    screens/          one module per screen
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
