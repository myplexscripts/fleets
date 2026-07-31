/* The opening, with one ship.

   The player now starts with the flagship and nothing else. Every other hull is
   one they take off somebody, which makes the first hour a real question — but
   it also means the first hour has no slack in it. Three worn-out schooners used
   to absorb a bad draw, a wrong call and a lost fight. Now there is one hull,
   and every one of the rules below is the difference between "close-run" and
   "there was never anything I could do".

     1. HOME WATER HAS TWO TIERS, AND ONE OF THEM IS WINNABLE. The fights the
        region is rated for have to be real — beatable by one ship, losable by
        one ship. But a chart on which EVERY option is a coin flip gives a
        captain with a single hull no way to build a second one, so there must
        also be a shallow tier a beginner can rely on. Both halves are checked,
        because a tuning pass that moves enemy strength moves both.

     1b. AND THERE HAVE TO BE ENOUGH OF THEM. Fighting is how a fleet gets
        built, so the starting region cannot run out of things to fight.

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

/* Nothing on the opening chart may sit below FLOOR — that is a fight asking for
   a fleet nobody can have yet. The fights the region is RATED for (no
   ratingMult) must also stay under CEIL, or home water means nothing.

   SOFT is the shallow tier: missions deliberately rated under their water, which
   are allowed — required — to be comfortable. At least SOFT_MIN of them, and at
   least FIGHTS_MIN things to fight in total, because a fleet is built by
   fighting and the starting region cannot run dry. */
const FLOOR = 25, CEIL = 75, SOFT = 70, SOFT_MIN = 2, FIGHTS_MIN = 8;

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

  const out = await p.evaluate(async ({ FLOOR, CEIL, SOFT, SOFT_MIN, FIGHTS_MIN }) => {
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
    let soft = 0;
    fights.forEach(r => {
      const o = avg(r);
      const shallow = (r.ratingMult || 1) < 1;
      lines.push(`  ${String(r.n).padEnd(28)} ${String(r.type).padEnd(8)} ${String(o + '%').padStart(4)} solo`
        + (shallow ? '   (shallows)' : ''));
      if (o < FLOOR) bad.push(`${r.n} is ${o}% for one ship — the opening asks for a fleet nobody can have yet`);
      /* Only the rated fights are capped. The shallows are supposed to be kind:
         that is the entire reason they exist. */
      if (!shallow && o > CEIL) bad.push(`${r.n} is ${o}% for one ship — home water is a formality`);
      if (shallow && o >= SOFT) soft++;
      if (shallow && o < SOFT) {
        bad.push(`${r.n} is meant to be the shallow tier but measures ${o}% — `
          + 'a beginner has nowhere reliable to win a hull');
      }
    });

    /* And the lane fights, which are the other thing a fresh save may take on. */
    const lanes = st.routes.filter(r => r.region === start && r.type === 'cargo');
    lanes.forEach(r => {
      st.S.lanes[r.id] = { d: 2, ts: Date.now(), region: r.region };
      const o = avg(r);
      lines.push(`  ${String(r.n + ' (lane)').padEnd(28)} ${'lane'.padEnd(8)} ${String(o + '%').padStart(4)} solo`);
      if (o < FLOOR) bad.push(`clearing ${r.n} is ${o}% for one ship`);
      delete st.S.lanes[r.id];
    });

    const total = fights.length + lanes.length;
    lines.push(`  ${total} things to fight in home water — ${fights.length} missions `
      + `(${soft} of them shallows) and ${lanes.length} lanes that can be cleared`);
    if (total < FIGHTS_MIN) {
      bad.push(`only ${total} fights in the starting region — a fleet is built by fighting, `
        + `and ${FIGHTS_MIN} is the least that keeps a session going`);
    }
    if (soft < SOFT_MIN) {
      bad.push(`only ${soft} fights sit at or above ${SOFT}% for a lone flagship — `
        + 'a captain with one hull needs somewhere they can rely on winning');
    }

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
  }, { FLOOR, CEIL, SOFT, SOFT_MIN, FIGHTS_MIN });

  await b.close();
  out.lines.forEach(l => console.log(l));
  console.log('');

  const bad = out.bad.concat(pageErrs.map(m => 'page error: ' + m));
  if (bad.length) {
    console.error('check-solo FAILED');
    bad.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log(`check-solo OK — one ship starts the game, home water is rated for her `
    + `(nothing under ${FLOOR}%, rated fights under ${CEIL}%),`);
  console.log(`there is a shallow tier to build a fleet out of, ${FIGHTS_MIN}+ things to fight, `
    + `a contract runnable on day one, and a way back from zero.`);
})();
