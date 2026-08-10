/* The onboarding script, walked step by step without playing the game.

   Two things have gone wrong here before, and both of them ended with a
   tutorial the player could not finish:

     1. A CARD PARKED ON ITS OWN TARGET. Every non-modal step rings an element
        and waits for the player to tap it. A card placed over that element is a
        step nobody can complete — and it is invisible in review, because the
        card looks fine and the target is simply underneath it. "Form the Line"
        shipped like this once, aimed at the footer button while sitting on top
        of the ship rail.

     2. A STEP WHOSE TARGET DOES NOT EXIST. A selector that no longer matches
        anything — renamed id, restructured screen — leaves the player reading a
        card with nothing ringed and no way forward. The code falls back to a
        centred card so it is never fatal, but a step that has quietly lost its
        target is still a step that no longer teaches what it was written to.

   Both are checked against real geometry in a real browser, because both are
   layout facts and neither can be read off the source.

   Run:  node tools/check-tutorial.js [url] */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-tutorial: playwright-core is not installed — cannot verify.');
  process.exit(2);
}

/* Where each step's target lives, so the walker can put the game there without
   playing through. A step whose target only exists mid-battle is checked by
   drive4, which actually fights.

   Only the screen is hardcoded. Which MISSION a sheet-step belongs to is read
   off the script itself — the nearest `only` at or above the step — so adding a
   step inside a block does not mean remembering to update a table here. */
const SCREEN = {
  '#tabRoutes': 'fleet', '#tabFlag': 'fleet', '#tabVoy': 'routes',
  '#main .item': 'fleet', '#main .hero': 'flag',
  '#shipPicks': 'routes', '#sailBtn': 'routes'
};
const needsSheet = sel => sel === '#shipPicks' || sel === '#sailBtn';
const screenFor = sel => SCREEN[sel] || (/^#node_/.test(sel) ? 'routes' : 'fleet');

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pageErrs = [];
  p.on('pageerror', e => pageErrs.push(e.message));
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.click('[data-act="title-new"]');
  await p.waitForTimeout(800);

  const steps = await p.evaluate(async () => {
    const t = await import('/src/data/tutorial.js');
    return t.TUTSTEPS.map((s, i) => ({
      i, title: s.title, sel: s.sel || null, modal: !!s.modal,
      when: s.when || null, only: s.only || null,
      words: String(s.text || '').split(/\s+/).length
    }));
  });

  const bad = [], lines = [];

  for (const s of steps) {
    /* Battle steps need a fight on screen; drive4 covers those by fighting. */
    if (s.when === 'battle' || s.when === 'prize') {
      lines.push(`  ${String(s.i).padStart(2)}  ${s.title.padEnd(26)} (mid-fight — drive4 walks this one)`);
      continue;
    }
    if (s.modal || !s.sel) {
      lines.push(`  ${String(s.i).padStart(2)}  ${s.title.padEnd(26)} centred card, nothing to cover`);
      continue;
    }

    /* The block this step belongs to names its mission with `only`; a sheet
       step inherits it from the nearest one at or above itself. */
    const block = steps.slice(0, s.i + 1).reverse().find(x => x.only);
    const stage = {
      tab: screenFor(s.sel),
      mission: needsSheet(s.sel) ? (block ? block.only : 'c3') : null
    };
    /* Shut whatever the last step left open FIRST and let it finish sliding.
       Closing and reopening in the same tick raced the sheet's own animation,
       and the footer was measured while it was still on its way out. */
    await p.evaluate(async () => {
      (await import('/src/ui/sheet.js')).closeSheet();
    });
    await p.waitForTimeout(500);

    await p.evaluate(async ({ n, stage }) => {
      const st = await import('/src/core/state.js');
      const shell = await import('/src/ui/shell.js');
      const bus = await import('/src/core/bus.js');
      const t = await import('/src/ui/tutorial.js');
      st.S.tut = n;
      shell.gotoTab(stage.tab, true);
      bus.render();
      if (stage.mission) {
        const m = await import('/src/ui/mission.js');
        m.openMission(stage.mission);
      }
      t.refreshTut();
    }, { n: s.i, stage });
    await p.waitForTimeout(1000);

    /* The commit button only has a box once a ship is in the line, and by the
       time this step is live the script has already made the player pick one
       (the step before it waits on ships:1). Stage that, or the button measures
       zero and the check is grading a state the player never sees. */
    if (s.sel === '#sailBtn') {
      await p.locator('#shipPicks .pickrow:not(.dis)').first().click().catch(() => {});
      await p.locator('#sailBtn').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(700);
    }

    const g = await p.evaluate((sel) => {
      const box = e => { if (!e) return null; const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom),
                 left: Math.round(r.left), right: Math.round(r.right) }; };
      const tip = document.getElementById('tutTip');
      const tgt = document.querySelector(sel);
      const t = box(tip), o = box(tgt);
      /* Rectangles, then the honest question: is the target's own centre
         reachable, or is the card sitting on it? */
      let over = 0, topmost = null;
      if (t && o) {
        const vy = Math.max(0, Math.min(t.bottom, o.bottom) - Math.max(t.top, o.top));
        const vx = Math.max(0, Math.min(t.right, o.right) - Math.max(t.left, o.left));
        over = vy > 0 && vx > 0 ? vy : 0;
        const el = document.elementFromPoint((o.left + o.right) / 2, (o.top + o.bottom) / 2);
        topmost = el ? (el.closest('#tutTip') ? 'tutTip' : (el.id || el.className || el.tagName)) : null;
      }
      return {
        tip: t, target: o, over, topmost,
        tipShown: tip ? getComputedStyle(tip).display !== 'none' : false
      };
    }, s.sel);

    if (!g.target) {
      bad.push(`step ${s.i} "${s.title}" points at ${s.sel}, which is not on the screen it locks to`);
      lines.push(`  ${String(s.i).padStart(2)}  ${s.title.padEnd(26)} TARGET MISSING (${s.sel})`);
      continue;
    }
    if (!g.tipShown) {
      bad.push(`step ${s.i} "${s.title}" shows no card at all`);
      continue;
    }
    /* In the DOM but with no box is the same dead end as not being there: the
       ring lands on nothing and there is nothing to tap. */
    if (g.target.bottom - g.target.top <= 0 || g.target.right - g.target.left <= 0) {
      bad.push(`step ${s.i} "${s.title}" points at ${s.sel}, which has no size on screen`);
      continue;
    }

    lines.push(`  ${String(s.i).padStart(2)}  ${s.title.padEnd(26)} ${String(s.sel).padEnd(14)}`
      + ` card ${g.tip.top}-${g.tip.bottom}, target ${g.target.top}-${g.target.bottom}`
      + `, overlap ${g.over}px, topmost at its centre: ${g.topmost}`);

    if (g.over > 0) {
      bad.push(`step ${s.i} "${s.title}" — the card overlaps ${s.sel} by ${g.over}px, `
        + 'and that is the element the player has to tap to continue');
    }
    if (g.topmost === 'tutTip') {
      bad.push(`step ${s.i} "${s.title}" — the card is what a thumb hits at the centre of ${s.sel}`);
    }
  }

  /* And the file's own rule about length, which is easy to break one helpful
     clarification at a time. */
  const wordy = steps.filter(s => s.words > 48);
  wordy.forEach(s => lines.push(`  note: "${s.title}" runs to ${s.words} words`));
  if (wordy.length > 2) {
    bad.push(`${wordy.length} steps run past 48 words — the script's own rule is one or two short sentences`);
  }

  await b.close();
  lines.forEach(l => console.log(l));
  console.log('');

  const all = bad.concat(pageErrs.map(m => 'page error: ' + m));
  if (all.length) {
    console.error('check-tutorial FAILED');
    all.forEach(l => console.error('  * ' + l));
    process.exit(1);
  }
  console.log('check-tutorial OK — every step has a target that exists, and no card sits on');
  console.log('the element its own step is telling the player to tap.');
})();
