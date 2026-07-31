/* The warehouse, and the ways a cap could lock a player out.

   A storage limit is the easiest thing in a game to build a dead end out of.
   Every rule below is one I could plausibly break in a later tuning pass by
   changing a single number, and every one of them ends the run if it goes:

     1. THE CAP IS PER KIND. Not a shared total. A shared warehouse is the
        classic trap — a hold full of worthless sugar locks you out of the metal
        you need to buy anything, including a bigger warehouse.

     2. OVERFLOW IS SOLD, NEVER LOST. Anything over the line goes on the quay at
        half price. There must be no state in which earning something leaves you
        worse off, and no reward you have to refuse because you cannot carry it.

     3. AN UPGRADE NEVER COSTS MORE OF A MATERIAL THAN THE CAP CAN HOLD. This is
        the one that actually bites: a warehouse costing 60 metal when you can
        only hold 40 is a wall no amount of play gets you over.

     4. THE BIGGEST CARGO CONTRACT FITS. A contract asking for more than the
        warehouse can ever hold is a contract that can never be run.

     5. EVERY UPGRADE IS AFFORDABLE FROM WHAT THE GAME PAYS. Materials come in
        at a known rate; a cost far beyond a session of fighting is a wall with
        a longer walk up to it.

   And for figureheads, the one rule that matters: a save can never be carrying
   a buff it did not earn.

   Run:  node tools/check-storage.js [url] */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-storage: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const pageErrs = [];
  p.on('pageerror', e => pageErrs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });

  const out = await p.evaluate(async () => {
    const st = await import('/src/core/state.js');
    const sel = await import('/src/core/selectors.js');
    const store = await import('/src/data/storage.js');
    const routes = await import('/src/data/routes.js');
    const figs = await import('/src/data/figureheads.js');
    const MATS = await import('/src/data/materials.js');
    const GOODS = await import('/src/data/goods.js');
    const bad = [], lines = [];

    st.newGame();

    /* ---- 3. every upgrade is payable at the cap it is paid from ---- */
    for (let lvl = 0; lvl < store.MAX_WAREHOUSE; lvl++) {
      const cap = store.storeCapAt(lvl);
      const c = store.warehouseCost(lvl);
      const worst = Math.max(...MATS.MAT_KEYS.map(m => c[m] || 0));
      lines.push(`  ${String(store.WAREHOUSE[lvl].n).padEnd(20)} cap ${String(cap).padStart(4)}`
        + `  ->  ${store.WAREHOUSE[lvl + 1].n} for ${c.gold} gold, ${worst} of the heaviest material`);
      if (worst > cap) {
        bad.push(`the ${store.WAREHOUSE[lvl + 1].n} costs ${worst} of a material `
          + `but a ${store.WAREHOUSE[lvl].n} only holds ${cap} — unbuyable`);
      }
    }
    lines.push(`  ${store.WAREHOUSE[store.MAX_WAREHOUSE].n.padEnd(20)} cap `
      + `${String(store.storeCapAt(store.MAX_WAREHOUSE)).padStart(4)}  (the last one)`);

    /* ---- 4. the biggest contract fits ---- */
    const biggest = routes.makeRoutes()
      .filter(r => r.type === 'cargo')
      .reduce((a, r) => Math.max(a, r.qty || 0), 0);
    const top = store.storeCapAt(store.MAX_WAREHOUSE);
    lines.push(`  biggest cargo contract ${biggest}, largest warehouse ${top}`);
    if (biggest > top) bad.push(`a contract asks for ${biggest} but nothing holds more than ${top}`);

    /* ---- 1. the cap is per kind ---- */
    st.S.wh = 0;
    const cap0 = sel.storeCap();
    MATS.MAT_KEYS.forEach(m => { st.S.mats[m] = 0; });
    GOODS.GOOD_KEYS.forEach(g => { st.S.goods[g] = 0; });
    /* Fill one good right to the brim, then try to earn a material. */
    sel.grantGood(GOODS.GOOD_KEYS[0], cap0 + 50);
    sel.takeSpill();
    const goldBefore = st.S.gold;
    sel.grant({ wood: 5 });
    const woodGot = st.S.mats.wood;
    lines.push(`  full of ${GOODS.GOOD_KEYS[0]} (${st.S.goods[GOODS.GOOD_KEYS[0]]}), `
      + `then earned ${woodGot} wood`);
    if (woodGot !== 5) {
      bad.push(`a warehouse full of one good blocked wood — got ${woodGot} of 5. The cap is not per kind.`);
    }

    /* ---- 2. overflow is sold, never lost ---- */
    st.S.goods[GOODS.GOOD_KEYS[0]] = cap0;
    const before = st.S.gold;
    sel.grantGood(GOODS.GOOD_KEYS[0], 40);
    const spill = sel.takeSpill();
    const paid = st.S.gold - before;
    lines.push(`  40 more into a full bin: kept 0, sold for ${paid} gold`);
    if (paid <= 0) bad.push('overflow paid nothing — a reward you cannot hold is a reward destroyed');
    if (!spill || spill.units !== 40) bad.push('the overflow was not reported to the player');
    if (st.S.goods[GOODS.GOOD_KEYS[0]] > cap0) bad.push('the cap did not hold');

    /* And the same for materials, which have no market price of their own. */
    st.S.mats.wood = cap0;
    const b2 = st.S.gold;
    sel.grant({ wood: 30 });
    sel.takeSpill();
    if (st.S.gold - b2 <= 0) bad.push('overflowing materials paid nothing');
    if (st.S.mats.wood > cap0) bad.push('the material cap did not hold');

    /* ---- 5. an upgrade is worth a session, not a month ---- */
    const first = store.warehouseCost(0);
    lines.push(`  the first upgrade: ${first.gold} gold, `
      + MATS.MAT_KEYS.filter(m => first[m]).map(m => first[m] + ' ' + m).join(', '));
    if (first.gold > 4000) bad.push(`the first warehouse is ${first.gold} gold — too far from the start`);

    /* ---- the names have to survive being put in a sentence ----
       Two screens write "The <warehouse>" and "Your <warehouse>". One of these
       is called The Long Cellar, which read as "The the long cellar" until
       storeName() started stripping the article — and the next name somebody
       adds with a "The" on the front would do it again. */
    for (let lvl = 0; lvl <= store.MAX_WAREHOUSE; lvl++) {
      const nm = store.storeName(lvl);
      const sentence = `The ${nm} would not take all of it.`;
      if (/^the\s+the\b/i.test(sentence)) bad.push(`"${sentence}" — doubled article`);
      if (/^\s*$/.test(nm)) bad.push(`warehouse ${lvl} has no name to put in a sentence`);
    }
    lines.push(`  in a sentence: "The ${store.storeName(store.MAX_WAREHOUSE)} would not take all of it."`);

    /* ---- figureheads ---- */
    const owned = figs.FIG_KEYS.filter(k => figs.FIGUREHEADS[k].cost);
    const dropped = figs.FIG_KEYS.filter(k => figs.FIGUREHEADS[k].boss);
    lines.push(`  figureheads: ${owned.length} for sale, ${dropped.length} off admirals`);
    if (!owned.length) bad.push('nothing is for sale — the mechanic is never introduced');
    if (!dropped.length) bad.push('no admiral drops one');
    figs.FIG_KEYS.forEach(k => {
      const d = figs.FIGUREHEADS[k];
      if (!d.fx || !Object.keys(d.fx).length) bad.push(`${k} has no effect at all`);
      if (!d.desc) bad.push(`${k} never says what it does`);
      if (d.cost && d.boss) bad.push(`${k} is both bought and dropped`);
    });
    /* Every admiral gives up exactly one, and no two share. */
    const byBoss = {};
    dropped.forEach(k => {
      const rk = figs.FIGUREHEADS[k].boss;
      byBoss[rk] = (byBoss[rk] || 0) + 1;
    });
    Object.keys(byBoss).forEach(rk => {
      if (byBoss[rk] > 1) bad.push(`${rk} drops ${byBoss[rk]} figureheads`);
    });

    /* A save can never wear a carving it does not own. */
    st.S.figureheads = [];
    st.S.figurehead = 'bull';
    st.save();
    st.load();
    const wearing = st.S.figurehead;
    lines.push(`  a save wearing an unowned carving loads as: ${wearing}`);
    if (wearing) bad.push('a save can wear a figurehead it never earned');

    /* And the effects actually reach the systems that own them. */
    st.S.figureheads = ['mermaid', 'ashgrave'];
    st.S.figurehead = null;
    const plainCap = sel.storeCap();
    st.S.figurehead = 'ashgrave';
    const bigCap = sel.storeCap();
    lines.push(`  The Grey Lady: warehouse ${plainCap} -> ${bigCap}`);
    if (bigCap <= plainCap) bad.push('a figurehead that should widen the warehouse changes nothing');

    const bs = await import('/src/battle/state.js');
    const ship = { speed: 5, guns: 5, hull: 30 };
    st.S.figurehead = null;
    const slow = bs.reloadMs(ship);
    st.S.figurehead = 'mermaid';
    const quick = bs.reloadMs(ship);
    lines.push(`  The Mermaid: reload ${slow}ms -> ${quick}ms`);
    if (quick >= slow) bad.push('a figurehead that should hurry the guns changes nothing');
    /* And never the enemy's. */
    if (bs.reloadMs(ship, false) !== slow) bad.push("your figurehead is hurrying the ENEMY's guns");

    /* The Drowned Girl: your line arrives loaded, theirs still has to close. */
    st.S.figureheads = ['ghost'];
    st.S.figurehead = 'ghost';
    const mine = bs.primeTimers([ship], false, true).get(ship);
    const theirs = bs.primeTimers([ship], false, false).get(ship);
    lines.push(`  The Drowned Girl: your meter opens at ${mine.at.toFixed(2)}, `
      + `theirs at ${theirs.at.toFixed(2)}`);
    if (mine.at < 0.9) bad.push('a figurehead that should open the fight loaded does not');
    if (theirs.at > 0.5) bad.push("your figurehead is loading the ENEMY's guns for them");

    return { bad, lines };
  });

  await b.close();
  out.lines.forEach(l => console.log(l));
  console.log('');

  const bad = out.bad.concat(pageErrs.map(m => 'page error: ' + m));
  if (bad.length) {
    console.error('check-storage FAILED');
    bad.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log('check-storage OK — the cap is per kind, overflow is sold rather than lost,');
  console.log('every warehouse can be paid for from the one before it, and no buff is unearned.');
})();
