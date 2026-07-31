/* The opening, with one ship.

   The player now starts with the flagship and nothing else. Every other hull is
   one they take off somebody, which makes the first hour a real question — but
   it also means the first hour has no slack in it. Three worn-out schooners used
   to absorb a bad draw, a wrong call and a lost fight. Now there is one hull,
   and every one of the rules below is the difference between "close-run" and
   "there was never anything I could do".

     1. EVERY OPENING FIGHT IS A COIN FLIP, NOT A WALL AND NOT A WALKOVER. One
        ship against the water she starts in has to be able to win, and has to
        be able to lose. A tuning pass that moves enemy strength moves this.

     2. THE FIRST CONTRACT CAN BE RUN ON DAY ONE. One hull carries it, and the
        starting stock covers it. A cargo run is the way back from a lost fight,
        so it cannot itself be gated behind having won one.

     3. THE FLAGSHIP CAN CARRY EVERY CONTRACT IN THE STARTING REGION. With no
        second hull there is no combining holds — a contract bigger than she is
        is a contract that cannot be run until the player captures something,
        and it is offered before they have.

     4. THE FIRST PRIZE CAN BE KEPT. Capture is the only source of ships, so a
        fresh save has to have a dock free to put one in.

     5. A HOLED FLAGSHIP AND AN EMPTY PURSE IS NOT A DEAD SAVE. With no other
        ship there is nothing else to send, so the free repair is the only thing
        standing between a bad night and a career that cannot continue.

   Run:  node tools/check-solo.js [url] */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* The band an opening fight has to land in. Below the floor the game is asking
   for a fleet the player has no way to have yet; above the ceiling the solo
   start is a formality and the first capture means nothing. */
const FLOOR = 25, CEIL = 75;

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-solo: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const pageErrs = [];
  p.on('pageerror', e => pageErrs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });

  const out = await p.evaluate(async ({ FLOOR, CEIL }) => {
    const st = await import('/src/core/state.js');
    const sel = await import('/src/core/selectors.js');
    const en = await import('/src/systems/enemies.js');
    const bad = [], lines = [];

    st.newGame();
    st.S.tut = 'done';
    const start = st.S.unlocked[0];

    /* ---- you start alone ---- */
    lines.push(`  a fresh save: ${st.S.ships.length} ships, `
      + `${st.S.docks} docks, ${st.S.gold} gold`);
    if (st.S.ships.length) bad.push(`a fresh save starts with ${st.S.ships.length} ships — it should be none`);

    /* ---- 4. and somewhere to put the first prize ---- */
    if (st.S.docks < 1) bad.push('no dock free — the first prize cannot be kept, and capture is the only source of ships');

    /* ---- 1. every opening fight is winnable and losable ----
       Odds are a forecast off one draw, so average a good many rather than
       trusting a single roll. */
    const flag = st.S.flag;
    const avg = r => {
      let t = 0;
      for (let i = 0; i < 60; i++) {
        st.S.draws = {};
        t += sel.battleOdds([flag], en.genEnemies(r));
      }
      return Math.round(t / 60);
    };

    const fights = st.routes.filter(r => r.region === start && sel.isBattle(r));
    fights.forEach(r => {
      const o = avg(r);
      lines.push(`  ${String(r.n).padEnd(28)} ${String(r.type).padEnd(8)} ${String(o + '%').padStart(4)} solo`);
      if (o < FLOOR) bad.push(`${r.n} is ${o}% for one ship — the opening asks for a fleet nobody can have yet`);
      if (o > CEIL) bad.push(`${r.n} is ${o}% for one ship — the solo start is a formality`);
    });
    if (!fights.length) bad.push('there is nothing to fight in the starting region');

    /* And the lane fights, which are the other thing a fresh save may take on. */
    const lanes = st.routes.filter(r => r.region === start && r.type === 'cargo');
    lanes.forEach(r => {
      st.S.lanes[r.id] = { d: 2, ts: Date.now(), region: r.region };
      const o = avg(r);
      lines.push(`  ${String(r.n + ' (lane)').padEnd(28)} ${'lane'.padEnd(8)} ${String(o + '%').padStart(4)} solo`);
      if (o < FLOOR) bad.push(`clearing ${r.n} is ${o}% for one ship`);
      delete st.S.lanes[r.id];
    });

    /* ---- 2 + 3. the contracts one hull has to be able to run ---- */
    let runnable = 0;
    lanes.forEach(r => {
      const fits = sel.holdCap([flag]) >= r.qty;
      const held = sel.goodsHeld(r.good) >= r.qty;
      lines.push(`  ${String(r.n).padEnd(28)} wants ${String(r.qty).padStart(3)} ${String(r.good).padEnd(8)}`
        + ` — she carries ${sel.holdCap([flag])}, you hold ${sel.goodsHeld(r.good)}`);
      if (!fits) {
        bad.push(`${r.n} asks for ${r.qty} and the flagship carries ${sel.holdCap([flag])} `
          + '— with no second hull there is nothing to combine');
      }
      if (fits && held) runnable++;
    });
    if (!runnable) {
      bad.push('no contract can be run from the starting stock — a cargo run is the way back '
        + 'from a lost fight and cannot be gated behind winning one');
    }
    lines.push(`  contracts runnable on day one: ${runnable} of ${lanes.length}`);

    /* ---- 5. holed and broke, with nothing else to send ---- */
    st.S.gold = 0;
    st.S.flag.hull = 0;
    const offered = sel.freeRepairOffered();
    lines.push(`  holed flagship, empty purse, no other ship: free repair offered ${offered}`);
    if (!offered) bad.push('a holed flagship and an empty purse is a dead save — nothing else can sail');

    return { bad, lines };
  }, { FLOOR, CEIL });

  await b.close();
  out.lines.forEach(l => console.log(l));
  console.log('');

  const bad = out.bad.concat(pageErrs.map(m => 'page error: ' + m));
  if (bad.length) {
    console.error('check-solo FAILED');
    bad.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log(`check-solo OK — one ship starts the game, every opening fight sits between`);
  console.log(`${FLOOR}% and ${CEIL}%, a contract can be run on day one, and there is a way back from zero.`);
})();
