/* The difficulty curve, printed and checked.

   Every fight in the game is drawn from a water rating and a band around it
   (src/data/water.js). Those are four numbers that decide whether the whole
   game is fun or a wall, and four numbers in a data file are exactly the kind
   of thing that quietly stops being true. So this runs the real modules in the
   real browser and prints the curve, then asserts the parts that must hold:

     1. The fight a water is RATED for is winnable by the fleet you can
        realistically have when you get there.
     2. A straggler draw is easy money.
     3. A heavy draw is a real risk — it must NOT be comfortable, or the band
        has no teeth.
     4. Each region's admiral is harder than anything that region fields
        normally, or she is not a climax.
     5. Every unlocked region offers at least three fights, one of them a hunt,
        so there is never a moment on the chart with nothing to fight.

   Run:  node tools/check-balance.js [url]
   Needs playwright-core and a server on the url (default :8137). */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* What a player can realistically field when they first reach each region.
   Flagship plus the two best hulls they are likely to have taken by then. This
   is the assumption the whole curve is tuned against, so it is written down
   here rather than living in somebody's head. */
const ARRIVE = {
  caribbean: { n: 'starting fleet',                 power: 34 + 22 + 18 },
  gulf:      { n: 'flagship coming along + brigs',  power: 52 + 22 + 22 },
  atlantic:  { n: 'half-built flagship + frigates', power: 70 + 31 + 31 },
  grand:     { n: 'worked-up flagship + heavies',   power: 88 + 44 + 31 },
  maxed:     { n: 'everything, fully built',        power: 106 + 44 + 44 }
};

/* Nobody fights an admiral the hour they arrive. She has to be provoked first,
   which is a region's worth of fighting — so she is measured against the fleet
   you have by the time you have earned her, not the one you turned up with. */
const CHALLENGE = {
  caribbean: 45 + 22 + 31,
  gulf:      64 + 31 + 31,
  atlantic:  88 + 44 + 31,
  grand:     106 + 44 + 44
};

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-balance: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

const pct = n => String(Math.round(n)).padStart(3) + '%';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  p.on('pageerror', e => console.error('[pageerror] ' + e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });

  const data = await p.evaluate(async () => {
    const water = await import('/src/data/water.js');
    const ships = await import('/src/data/ships.js');
    const bosses = await import('/src/data/bosses.js');
    const routes = await import('/src/data/routes.js');
    const world = await import('/src/data/world.js');

    const pw = s => Math.round(s.guns * 2 + s.speed + s.hull / 5);
    const rating = (rk, d, heat) => Math.round(
      water.REGION_RATING[rk] * (1 + water.DANGER_MULT * d + water.HEAT_MULT * heat));

    const bossPower = {};
    for (const rk in bosses.BOSSES) {
      const bo = bosses.BOSSES[rk];
      bossPower[rk] = {
        line: bo.ships.reduce((a, s) => a + pw(s), 0),
        withReinf: bo.ships.reduce((a, s) => a + pw(s), 0)
          + (bo.reinforcements || []).reduce((a, s) => a + pw(s), 0),
        n: bo.n
      };
    }

    const rs = routes.makeRoutes();
    const byRegion = {};
    for (const rk in world.REGIONS) {
      const mine = rs.filter(r => r.region === rk);
      byRegion[rk] = {
        battles: mine.filter(r => world.BATTLE_TYPES.includes(r.type)).map(r => r.type),
        voyages: mine.filter(r => world.VOYAGE_TYPES.includes(r.type)).length,
        gated: mine.filter(r => r.requiresBoss).length
      };
    }

    return {
      regions: Object.keys(world.REGIONS),
      names: Object.fromEntries(Object.entries(world.REGIONS).map(([k, v]) => [k, v.n])),
      bands: water.BANDS,
      ladder: water.LADDER,
      rating, bossPower, byRegion,
      stock: Object.fromEntries(Object.entries(ships.TYPES).map(([k, t]) => [k, pw(t)]))
    };
  });

  /* battleOdds, mirrored from core/selectors.js so the report speaks the same
     language as the game rather than a second opinion of it. */
  const odds = (fp, ep) => {
    const ratio = fp / Math.max(1, ep);
    return Math.max(3, Math.min(100, Math.round(100 * (1 - Math.exp(-1.6 * Math.pow(ratio, 2.2))))));
  };

  const bands = await p.evaluate(() => import('/src/data/water.js').then(m => m.BANDS));
  const rate = await p.evaluate(() => import('/src/data/water.js')
    .then(m => ({ R: m.REGION_RATING, D: m.DANGER_MULT, H: m.HEAT_MULT })));
  const rating = (rk, d, heat) => Math.round(rate.R[rk] * (1 + rate.D * d + rate.H * heat));

  const bad = [];

  console.log('stock hull ratings:', JSON.stringify(data.stock));
  console.log('ladder            :', data.ladder.map(l => `${l.type}@${l.from}`).join('  '));
  console.log('');

  for (const rk of data.regions) {
    const fleet = ARRIVE[rk];
    const worst = rating(rk, 2, 2);          // drifted lane, badly wanted
    const quiet = rating(rk, 0, 0);
    console.log(`${data.names[rk].toUpperCase()}  — arriving with ${fleet.power} power (${fleet.n})`);
    console.log(`  water rating: ${quiet} quiet … ${worst} at its worst`);

    for (const band of bands) {
      const lo = Math.round(worst * band.lo), hi = Math.round(worst * band.hi);
      const oLo = odds(fleet.power, lo), oHi = odds(fleet.power, hi);
      const label = (band.n || 'rated').padEnd(10);
      console.log(`    ${label} ${String(Math.round(band.share * 100)).padStart(3)}%  `
        + `enemy ${String(lo).padStart(3)}-${String(hi).padStart(3)}  `
        + `odds ${pct(oHi)}-${pct(oLo)}`);

      if (band.key === 'rated' && oHi < 35) {
        bad.push(`${rk}: the fight this water is RATED for is only ${oHi}% at its worst — unwinnable on arrival`);
      }
      if (band.key === 'straggler' && oLo < 75) {
        bad.push(`${rk}: stragglers are only ${oLo}% — the easy band is not easy`);
      }
      if (band.key === 'heavy' && oHi > 80) {
        bad.push(`${rk}: heavies are ${oHi}% — the risky band carries no risk`);
      }
    }

    const bp = data.bossPower[rk];
    if (bp) {
      const heavyTop = Math.round(worst * 1.6);
      const ready = CHALLENGE[rk];
      const vsReady = odds(ready, bp.line);
      const vsMax = odds(ARRIVE.maxed.power, bp.line);
      console.log(`    admiral    ${bp.n}: ${bp.line} power`
        + (bp.withReinf !== bp.line ? ` (+reinforcements → ${bp.withReinf})` : '')
        + `  — ${vsReady}% with the ${ready}-power fleet that provoked her, ${vsMax}% fully built`);
      if (bp.line <= heavyTop) {
        bad.push(`${rk}: the admiral (${bp.line}) is weaker than a heavy draw in her own water (${heavyTop})`);
      }
      if (vsReady < 40) bad.push(`${rk}: the admiral is only ${vsReady}% for the fleet that earned her — a wall`);
      if (vsReady > 85) bad.push(`${rk}: the admiral is ${vsReady}% — a set piece should not be a formality`);
    }

    const reg = data.byRegion[rk];
    /* Hunts and convoys both go quiet for a while after you take them, so the
       floor is what is left standing with both of them cleared. */
    const standing = reg.battles.filter(t => t !== 'hunt' && t !== 'convoy').length;
    console.log(`    chart      ${reg.battles.length} fights [${reg.battles.join(', ') || 'none'}], `
      + `${standing} of them permanent, ${reg.voyages} voyages`);
    if (standing < 3) bad.push(`${rk}: only ${standing} permanent fights — needs 3 with the respawners cleared`);
    if (!reg.battles.includes('hunt')) bad.push(`${rk}: no hunting ground — nothing that never runs out`);
    if (!reg.battles.includes('convoy')) bad.push(`${rk}: no convoy — nowhere to take trade goods by force`);
    console.log('');
  }

  /* ---- bounties ----

     The one fight on the chart that is deliberately above its water. She has to
     land in a narrow place: hard enough that beating the region's ordinary
     traffic does not qualify you, winnable enough that she is an invitation
     rather than a wall — and paying enough to be worth the risk of a mauling.

     She is measured against the fleet you have while a region is your current
     one, not the one you arrive with, because a bounty is something you take on
     when you are established somewhere. */
  const bt = await p.evaluate(async () => {
    const cfg = await import('/src/core/config.js');
    return {
      mult: cfg.BOUNTY_RATING_MULT,
      gold: cfg.BOUNTY_GOLD_PER_RATING,
      lifeMin: cfg.BOUNTY_LIFE_MS / 60000
    };
  });

  console.log('BOUNTIES  — drawn at ' + bt.mult + 'x her water, ' + bt.lifeMin + ' minute window');
  for (const rk of data.regions) {
    const worst = rating(rk, 2, 2);
    const her = Math.round(worst * bt.mult);
    /* Her line rolls a band like anything else, so she spans the same spread. */
    const lo = Math.round(her * 0.90), hi = Math.round(her * 1.30);
    const ready = CHALLENGE[rk];
    const oLo = odds(ready, lo), oHi = odds(ready, hi);
    const heavyTop = Math.round(worst * 1.6);
    const purse = Math.round(her * bt.gold);

    console.log(`  ${data.names[rk].padEnd(18)} enemy ${String(lo).padStart(3)}-${String(hi).padStart(3)}  `
      + `odds ${pct(oHi)}-${pct(oLo)} for the ${ready}-power fleet  purse ${purse}`);

    if (her <= Math.round(worst * 1.1)) {
      bad.push(`${rk}: a bounty (${her}) is no harder than the water she is in (${worst}) — not a challenge`);
    }
    if (oHi < 25) bad.push(`${rk}: a bounty is only ${oHi}% at her worst — a wall, not an invitation`);
    if (oLo > 90) bad.push(`${rk}: a bounty is ${oLo}% at her easiest — free money on a timer`);
    const bp = data.bossPower[rk];
    if (bp && her >= bp.line) {
      bad.push(`${rk}: a bounty (${her}) is at least as hard as the admiral (${bp.line}) — she outranks the set piece`);
    }
  }
  console.log('');

  /* ---- the economy ----

     What a fight LISTS is not what a fight PAYS. Every hull you beat is a prize
     worth 150 to 1,200 gold on its own, so a patrol that lists 180 gold and
     hands you three ships is really worth closer to a thousand. That gap is why
     the game could be broken open in five minutes: the costs were being set
     against the listed numbers and the player was earning the real ones.

     So income here is modelled the way it is actually made — listed reward plus
     the ransoms off the line you just beat — and checked against what there is
     to spend it on. */
  const ec = await p.evaluate(async () => {
    const routes = await import('/src/data/routes.js');
    const world = await import('/src/data/world.js');
    const fl = await import('/src/data/flagship.js');
    const ships = await import('/src/data/ships.js');
    const salv = await import('/src/data/salvage.js');

    const ladder = k => {
      let g = 0;
      for (let t = 0; t < 6; t++) g += fl.tierCost(k, t).gold;
      return g;
    };
    const flagAll = fl.TIER_KEYS.reduce((a, k) => a + ladder(k), 0)
      + Object.values(fl.FITTINGS).reduce((a, f) => a + f.cost.gold, 0);

    let bells = 0;
    for (let i = 0; i < salv.MAX_BELL; i++) bells += salv.bellCost(i).gold;

    const byRegion = {};
    for (const rk in world.REGIONS) {
      const rs = routes.makeRoutes().filter(r => r.region === rk);
      const listed = rs.reduce((a, r) => a + ((r.rew && r.rew.gold) || 0), 0);
      const fights = rs.filter(r => world.BATTLE_TYPES.includes(r.type)).length;
      byRegion[rk] = { listed, fights };
    }

    return {
      byRegion, flagAll, bells,
      firstTier: fl.tierCost('plate', 0).gold,
      lastTier: fl.tierCost('plate', 5).gold,
      ransom: Object.fromEntries(Object.entries(ships.TYPES).map(([k, t]) => [k, t.ransom])),
      hullCost: Object.fromEntries(Object.entries(ships.TYPES).map(([k, t]) => [k, t.cost]))
    };
  });

  /* A won fight leaves two or three hulls on the water; ransoming the middling
     one is the ordinary choice, so that is what a sweep is priced at. */
  const perPrize = ec.ransom.brig;
  const PRIZES = 2.5;

  console.log('ECONOMY');
  let sweep = 0;
  for (const rk of data.regions) {
    const r = ec.byRegion[rk];
    const real = r.listed + Math.round(r.fights * PRIZES * perPrize);
    if (rk === 'caribbean') sweep = real;
    console.log(`  ${data.names[rk].padEnd(18)} listed ${String(r.listed).padStart(5)}  `
      + `+ ${r.fights} fights of prizes  = about ${real} a sweep`);
  }
  console.log(`  first flagship tier ${ec.firstTier}, last ${ec.lastTier}`);
  console.log(`  the whole flagship ${ec.flagAll}, every bell ${ec.bells}`);
  console.log(`  a Caribbean sweep buys ${(sweep / ec.flagAll * 100).toFixed(1)}% of the flagship`);

  /* The first upgrade has to land early — a game that makes you wait for the
     first taste of progress is one nobody reaches the second of. */
  if (ec.firstTier > sweep / 2) {
    bad.push(`the first flagship tier (${ec.firstTier}) costs more than half a Caribbean sweep — too slow to start`);
  }
  /* And the whole thing has to be a campaign, not an afternoon. One sweep of
     the starting region should not visibly dent it. */
  const dent = sweep / ec.flagAll;
  if (dent > 0.06) {
    bad.push(`one Caribbean sweep buys ${(dent * 100).toFixed(0)}% of the flagship — the game is over in an evening`);
  }
  if (dent < 0.005) {
    bad.push(`one Caribbean sweep buys only ${(dent * 100).toFixed(1)}% of the flagship — a grind`);
  }
  /* Buying a hull must never be cheaper than the prize it competes with, or
     nobody would ever bother taking one. */
  for (const k in ec.hullCost) {
    if (ec.hullCost[k] <= ec.ransom[k] * 2) {
      bad.push(`a ${k} costs ${ec.hullCost[k]} and ransoms for ${ec.ransom[k]} — buying is not the expensive way`);
    }
  }
  console.log('');

  await b.close();

  if (bad.length) {
    console.error('check-balance FAILED');
    bad.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log('check-balance OK — every water is fightable, every band means something,');
  console.log('every admiral is the hardest thing in her region, and nowhere is short of a fight.');
})();
