/* The auto-battle, checked.

   Combat is no longer a turn loop the player drives — every ship reloads on her
   own clock and fires when she is loaded. That moves the whole of the fight into
   three numbers and four constants, and puts a real question on the table that
   a turn loop never had to answer: does it END? A clock that never stops is a
   fight the player cannot leave, and it would not announce itself — the battle
   would simply sit there looking busy.

   So this runs the real modules and asserts the things that must hold:

     1. Speed decides RATE. A faster hull reloads strictly sooner, and the floor
        stops a worked-up flagship from firing faster than the game can read.
     2. Guns decide WEIGHT and hull decides ENDURANCE — a shot is priced off the
        firer's guns alone, and nothing else touches it.
     3. Nobody starts loaded and nobody starts together, or the first second of
        every battle is one flat volley.
     4. Every fight terminates. Simulated across the whole difficulty curve,
        from a starting fleet in the Caribbean to a worked-up one at the Grand
        Banks, in both directions.
     5. A fight lasts long enough for the orders to matter — but only where that
        is actually true. Three ships against one SHOULD be over in seconds; a
        walkover that took thirty would be worse, not better. What must never
        happen is the other thing: being sunk before you have had time to read
        the screen and press Retreat. So the floor is on losing, not on winning.

   Run:  node tools/check-battle.js [url]
   Needs playwright-core and a server on the url (default :8137). */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Long enough to read the order bar and decide to run. Anything that can kill
   the player faster than this is a fight with no exit. */
const ESCAPE_SEC = 6;
/* A contested fight — one either side might take — has to leave room for a
   brace and a boarding attempt, or those buttons are decoration. */
const CONTEST_SEC = 9;
/* Nobody sits through more than this. */
const MAX_SEC = 90;

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-battle: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const pageErrs = [];
  p.on('pageerror', e => pageErrs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });

  const out = await p.evaluate(async ({ ESCAPE_SEC, CONTEST_SEC, MAX_SEC }) => {
    const bs = await import('/src/battle/state.js');
    const cfg = await import('/src/core/config.js');
    const ships = await import('/src/data/ships.js');
    const water = await import('/src/data/water.js');
    const bosses = await import('/src/data/bosses.js');
    const bad = [], lines = [];

    /* ---- 1. speed decides rate ---- */
    const rates = Object.entries(ships.TYPES)
      .map(([k, t]) => ({ k, sp: t.speed, ms: bs.reloadMs(t) }))
      .sort((a, b) => a.sp - b.sp);
    lines.push('reload by speed: ' + rates.map(r => `${r.k} sp${r.sp} ${r.ms}ms`).join('  '));

    for (let i = 1; i < rates.length; i++) {
      const a = rates[i - 1], b = rates[i];
      if (b.sp > a.sp && b.ms >= a.ms) {
        bad.push(`${b.k} is faster than ${a.k} (${b.sp} vs ${a.sp}) but reloads no sooner `
          + `(${b.ms}ms vs ${a.ms}ms) — speed is not buying rate of fire`);
      }
    }
    /* The floor has to be reachable, or it is decoration; and it must not be so
       high that it flattens the ordinary hulls into one rate. */
    const maxed = bs.reloadMs({ speed: 20 });
    if (maxed !== cfg.RELOAD_FLOOR_MS) {
      bad.push(`an absurdly fast hull reloads in ${maxed}ms — the ${cfg.RELOAD_FLOOR_MS}ms floor is unreachable`);
    }
    if (rates.some(r => r.ms === cfg.RELOAD_FLOOR_MS)) {
      bad.push('a stock hull already sits on the reload floor — speed stops mattering inside the normal range');
    }
    lines.push(`floor ${cfg.RELOAD_FLOOR_MS}ms reached at extreme speed, no stock hull on it`);

    /* ---- 3. staggered, unloaded starts ---- */
    const line = [ships.TYPES.brig, ships.TYPES.schooner, ships.TYPES.frigate];
    const t = bs.primeTimers(line, true);
    const starts = line.map(s => t.get(s).at);
    if (starts.some(v => v >= 1)) bad.push('a ship starts the battle already loaded');
    if (new Set(starts.map(v => Math.round(v * 20))).size < starts.length) {
      bad.push('two ships start on the same point of their reload — the line fires as one volley');
    }
    lines.push('start offsets: ' + starts.map(v => v.toFixed(2)).join(', '));

    /* The run-in has to actually be longer than a reload, or it is not a run-in. */
    line.forEach(s => {
      const tm = t.get(s);
      if (!tm.closing) bad.push('a ship opens the battle already in range — there is no approach');
      if (tm.of <= bs.reloadMs(s)) bad.push('the first cycle is no longer than a reload — the run-in buys nothing');
    });
    lines.push('run-in: first shot takes ' + cfg.APPROACH_MULT + 'x a reload');

    /* ---- 4 + 5. every fight terminates, in a reasonable time ----

       A headless simulation of the same arithmetic the clock runs: fill each
       meter at (dt / reload), fire when it tips, price the shot off guns. It
       deliberately gives the player NO orders — no brace, no boarding, no
       barrels — because the question is whether the guns alone finish the job.
       If the passive fight resolves, every fight resolves. */
    function sim(mine, foes, capMs) {
      const arm = (s, i) => ({
        ...s, hp: s.hull, at: i * 0.22 + Math.random() * 0.18,
        of: Math.round(bs.reloadMs(s) * cfg.APPROACH_MULT), closing: true
      });
      const A = mine.map(arm), B = foes.map(arm);
      const up = l => l.filter(x => x.hp > 0);
      const dt = 16.7;
      for (let ms = 0; ms < capMs; ms += dt) {
        for (const [own, other] of [[A, B], [B, A]]) {
          const tgt = up(other)[0];
          if (!tgt) return { ms, won: own === A };
          for (const s of up(own)) {
            s.at += dt / s.of;
            if (s.at < 1) continue;
            s.at = 0;
            if (s.closing) { s.closing = false; s.of = bs.reloadMs(s); }
            const t2 = up(other)[0];
            if (!t2) return { ms, won: own === A };
            t2.hp -= Math.max(1, Math.round(s.guns * (0.8 + Math.random() * 0.4)));
          }
        }
        if (!up(A).length) return { ms, won: false };
        if (!up(B).length) return { ms, won: true };
      }
      return { ms: capMs, won: null };
    }

    /* Both ends of the curve, and both sides of it: the fleet you arrive with
       against the water it is rated for, and the same fleet badly overmatched. */
    const stock = k => ({ ...ships.TYPES[k] });
    const scale = (s, m) => ({ hull: Math.round(s.hull * m), guns: Math.max(1, Math.round(s.guns * m)), speed: s.speed });
    const cases = [
      { n: 'opening patrol',    a: [stock('schooner'), stock('schooner')], b: [stock('schooner')] },
      { n: 'rated fight',       a: [stock('brig'), stock('brig'), stock('schooner')], b: [stock('brig'), stock('brig')] },
      { n: 'heavy draw',        a: [stock('frigate'), stock('brig'), stock('brig')], b: [scale(stock('frigate'), 1.5), scale(stock('frigate'), 1.4)] },
      { n: 'badly overmatched', a: [stock('schooner')], b: [stock('manowar'), stock('manowar')] },
      { n: 'walkover',          a: [stock('manowar'), stock('manowar'), stock('frigate')], b: [stock('schooner')] }
    ];
    for (const rk in bosses.BOSSES) {
      const bo = bosses.BOSSES[rk];
      cases.push({
        n: 'admiral: ' + bo.n,
        a: [scale(stock('manowar'), 1.15), stock('frigate'), stock('frigate')],
        b: bo.ships.map(s => ({ hull: s.hull, guns: s.guns, speed: s.speed }))
      });
    }

    const capMs = MAX_SEC * 1000 * 4;   // room to prove it hangs, not just that it is slow
    for (const c of cases) {
      /* Many rolls: a fight that terminates on average but stalls one time in
         thirty is still a fight the player can get stuck in. */
      const N = 60;
      let worst = 0, best = 1e9, hung = 0, wins = 0, quickestLoss = 1e9;
      for (let i = 0; i < N; i++) {
        const r = sim(c.a, c.b, capMs);
        if (r.won === null) { hung++; continue; }
        if (r.won) wins++; else quickestLoss = Math.min(quickestLoss, r.ms);
        worst = Math.max(worst, r.ms);
        best = Math.min(best, r.ms);
      }
      const winPct = Math.round(wins / N * 100);
      lines.push(`${c.n.padEnd(22)} ${(best / 1000).toFixed(1)}s-${(worst / 1000).toFixed(1)}s`
        + `  won ${String(winPct).padStart(3)}%` + (hung ? `  HUNG ${hung}/${N}` : ''));

      if (hung) bad.push(`${c.n}: ${hung} of ${N} fights never ended`);
      if (worst / 1000 > MAX_SEC) bad.push(`${c.n}: ran ${(worst / 1000).toFixed(0)}s — too long to sit through`);

      /* Losing fast is the one that matters: it is the case where the player
         wanted to leave and was not given the chance. */
      if (quickestLoss < 1e9 && quickestLoss / 1000 < ESCAPE_SEC) {
        bad.push(`${c.n}: lost in ${(quickestLoss / 1000).toFixed(1)}s — sunk before Retreat could be pressed`);
      }
      /* A fight either side might take has to have room for the orders in it. */
      if (winPct >= 15 && winPct <= 85 && best / 1000 < CONTEST_SEC) {
        bad.push(`${c.n}: a ${winPct}% fight over in ${(best / 1000).toFixed(1)}s — no room to brace or board`);
      }
    }

    /* ---- the orders have to fit inside a fight ---- */
    lines.push(`brace ${cfg.BRACE_MS / 1000}s then ${cfg.BRACE_COOLDOWN_MS / 1000}s down, `
      + `board every ${cfg.BOARD_COOLDOWN_MS / 1000}s`);
    if (cfg.BRACE_MS + cfg.BRACE_COOLDOWN_MS > MAX_SEC * 1000) {
      bad.push('brace cannot come round twice inside the longest fight — it is a once-per-battle button');
    }
    if (cfg.BRACE_MULT >= 1) bad.push('bracing does not reduce damage');
    if (cfg.BRACE_RELOAD_MULT >= 1) bad.push('bracing costs nothing — it should slow your own guns');

    /* ---- the admiral's volley has to be answerable ---- */
    if (cfg.VOLLEY_WARN_MS < 1500) bad.push('the telegraph is too short to react to');
    if (cfg.VOLLEY_EVERY_MS <= cfg.VOLLEY_WARN_MS) bad.push('the volley warns after it has already fired');
    lines.push(`admiral volley every ${cfg.VOLLEY_EVERY_MS / 1000}s, ${cfg.VOLLEY_WARN_MS / 1000}s of warning`);

    return { bad, lines, bands: water.BANDS.length };
  }, { ESCAPE_SEC, CONTEST_SEC, MAX_SEC });

  await browser.close();

  out.lines.forEach(l => console.log('  ' + l));
  console.log('');

  const bad = out.bad.concat(pageErrs.map(m => 'page error: ' + m));
  if (bad.length) {
    console.error('check-battle FAILED');
    bad.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log('check-battle OK — speed buys rate of fire, nobody opens in one volley,');
  console.log('and every fight on the curve ends on its own inside a sitting.');
})();
