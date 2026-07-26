# Salt & Powder

A fleet-command game set in the age of sail. Clear shipping lanes by force, then
run cargo along them; spend the takings on hulls, guns and charters; and when
your notoriety in a region fills up, its admiral comes looking for you.

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
    selectors.js      derived facts (power, danger, voyages) — pure reads
    settings.js       player options, stored separately from the save
    actions.js        data-act click delegation
    bus.js            tiny event bus, used to keep imports acyclic
    dom.js  rng.js    helpers
  data/               pure content: ships, routes, ports, charters, bosses,
                      flagship upgrades, flavour text, tutorial script
  art/                procedural ship sprites and icons (SVG → canvas)
  fx/                 sound, toasts, transitions, coins, mist, haptics
  systems/            voyages, notoriety, enemy generation, battle outcomes
  ui/
    shell.js          screen router, nav, world ticker
    screens/          one module per screen
    mission.js        mission sheet and launch
    result.js         after-action report and prizes
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

## Save data

`localStorage`:

- `saltpowder` — the game. `core/state.js#migrate` upgrades older shapes on
  load, so adding fields is safe.
- `sp_settings` — audio, motion, haptics. Survives starting a new game.
- `sp_tutdone` — whether the tutorial has ever been finished.
