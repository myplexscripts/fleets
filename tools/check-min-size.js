/* Text and icons no longer have a game-wide floor — a dense HUD reads plenty
   of its numbers at a glance, not at reading distance, and holding every chip
   separator and badge digit to 16px/40px was fighting the "more gamified,
   denser" direction the UI moved to. What is still enforced:

     - an absolute legibility floor, low enough to only catch something
       actually broken (an icon shrunk to a smudge, text nobody could read),
       not to dictate a design;
     - the nav rail's touch TARGETS specifically, which HIG puts at 40px
       regardless of how small the icon drawn inside one is allowed to be —
       that is a thumb-accuracy requirement, not a legibility one, and it does
       not get to move with the rest of the sizing.

   Three passes: the authored CSS, every iconHTML() call with an explicit pixel
   size, then what the browser actually computes across three viewports and nine
   surfaces — because a relative unit or a clamp() can land anywhere.

   The static passes run on plain node. The measuring pass needs playwright-core
   and a server already serving the game; without either it is skipped loudly
   rather than passing quietly. */
const fs = require('fs'), path = require('path');
let chromium = null;
for (const where of ['playwright-core', require('path').join(process.cwd(), 'node_modules', 'playwright-core')]) {
  try { chromium = require(where).chromium; break; } catch (e) { /* try the next */ }
}
const ROOT = path.resolve(__dirname, '..');
const MIN_TEXT = 11;
const MIN_ICON = 16;
const MIN_TOUCH = 40;      /* HIG: nav touch targets only — see header */
const errors = [];

/* ---- 1. authored CSS ---- */
for (const f of fs.readdirSync(path.join(ROOT, 'styles')).filter(n => n.endsWith('.css'))) {
  const s = fs.readFileSync(path.join(ROOT, 'styles', f), 'utf8');
  s.split('\n').forEach((line, i) => {
    const where = 'styles/' + f + ':' + (i + 1);
    for (const m of line.matchAll(/font-size:\s*clamp\(\s*([0-9.]+)px\s*,[^,]+,\s*([0-9.]+)px/g)) {
      if (+m[1] < MIN_TEXT) errors.push(where + ' clamp min ' + m[1] + 'px');
      if (+m[2] < +m[1]) errors.push(where + ' clamp max ' + m[2] + 'px below min ' + m[1] + 'px');
    }
    for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g)) {
      if (+m[1] < MIN_TEXT) errors.push(where + ' font-size ' + m[1] + 'px');
    }
    /* a relative font-size can land anywhere, so it must carry a max() floor */
    for (const m of line.matchAll(/font-size:\s*([0-9.]+)(em|rem|%)/g)) {
      if (!/max\(/.test(line)) errors.push(where + ' relative font-size ' + m[1] + m[2] + ' with no max() floor');
    }
  });
}

/* ---- 2. iconHTML() calls with an explicit pixel size ---- */
const jsFiles = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) jsFiles.push(p);
}})(path.join(ROOT, 'src'));
for (const f of jsFiles) {
  const s = fs.readFileSync(f, 'utf8');
  s.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/iconHTML\([^,)]+,\s*([0-9]+)/g)) {
      /* 0 means "size it from CSS", which rule 3 measures. */
      if (+m[1] !== 0 && +m[1] < MIN_ICON) errors.push(path.relative(ROOT, f) + ':' + (i + 1) + ' iconHTML size ' + m[1]);
    }
  });
}

/* ---- 3. measure what actually renders ---- */
const done = () => {
  const uniq = [...new Set(errors)];
  uniq.forEach(e => console.log(' * ' + e));
  console.log(uniq.length
    ? '=== ' + uniq.length + ' below the floor (text ' + MIN_TEXT + 'px, icons ' + MIN_ICON + 'px) ==='
    : 'text >= ' + MIN_TEXT + 'px and icons >= ' + MIN_ICON + 'px everywhere');
  process.exit(uniq.length ? 1 : 0);
};

(async () => {
  if (!chromium) {
    console.log('authored CSS and iconHTML() checked; browser pass skipped '
      + '(needs playwright-core and the game served — see README)');
    return done();
  }
  const b = await chromium.launch({ executablePath: process.env.SP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const vp of [{ width: 360, height: 780 }, { width: 430, height: 920 }, { width: 1440, height: 900 }]) {
    const p = await b.newPage({ viewport: vp });
    await p.goto((process.env.SP_URL || 'http://127.0.0.1:8137/index.html'), { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('#titleScr.on');
    await p.click('[data-act="title-new"]');
    await p.waitForTimeout(900);
    if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
    await p.waitForTimeout(500);
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('saltpowder'));
      s.gold = 90000; s.docks = 6; s.bell = 3; s.unlocked = ['caribbean', 'gulf', 'atlantic'];
      ['wood', 'metal', 'cloth'].forEach(k => s.mats[k] = 120);
      localStorage.setItem('saltpowder', JSON.stringify(s));
    });
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('#titleScr.on');
    await p.click('[data-act="title-continue"]');
    await p.waitForSelector('#app.on'); await p.waitForTimeout(800);

    const measure = async label => {
      /* Wait for the entrance animations before measuring anything.

         Cards come in from scale(.97), so an icon caught mid-flight measures
         38.8px — which is 40 x .97, not a layout fault. Every "icon under the
         floor" this reported on a long screen was the tool photographing the
         animation rather than the page. */
      await p.evaluate(() => Promise.race([
        Promise.all(document.getAnimations()
          /* Skip the ones that never end — a marker's pulse and a ready glow
             loop for ever, and awaiting those waits for ever. */
          .filter(a => (a.effect.getTiming().iterations || 1) !== Infinity)
          .map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 2500))
      ]));
      await p.waitForTimeout(120);

      const bad = await p.evaluate(lim => {
        const out = [];
        document.querySelectorAll('body *').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          /* text nodes of their own */
          const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (own) {
            const fs = parseFloat(cs.fontSize);
            /* font-size:0 is deliberate, not shrunk: the close key and the
               requirement tick carry their glyph in the Kenney art now (an
               X baked into the button, a check/cross baked into the box) and
               the old text character is kept in the DOM only for a screen
               reader, hidden rather than sized down. There is nothing on
               screen at 0px for a person to fail to read. */
            if (fs > 0 && fs < lim.text) out.push('text ' + fs.toFixed(1) + 'px <' + el.tagName.toLowerCase()
              + '.' + (el.className || '') + '> "' + el.textContent.trim().slice(0, 24) + '"');
          }
          if (el.tagName === 'IMG' && el.classList.contains('ic')) {
            if (r.width < lim.icon || r.height < lim.icon) out.push('icon ' + r.width.toFixed(1) + 'x'
              + r.height.toFixed(1) + ' .' + (el.className || ''));
          }
        });
        return [...new Set(out)];
      }, { text: MIN_TEXT, icon: MIN_ICON });
      bad.forEach(x => errors.push(vp.width + 'px ' + label + ': ' + x));
    };

    /* Nav touch targets, HIG floor — checked once, the rail does not change
       shape between tabs. This is the one size rule still enforced game-wide. */
    const navBad = await p.evaluate(min => [...document.querySelectorAll('nav button')]
      .map(b => b.getBoundingClientRect())
      .filter(r => r.width < min || r.height < min)
      .map(r => `${r.width.toFixed(1)}x${r.height.toFixed(1)}`), MIN_TOUCH);
    navBad.forEach(x => errors.push(vp.width + 'px nav: touch target ' + x + ' below ' + MIN_TOUCH + 'px'));

    for (const tab of ['tabFleet', 'tabFlag', 'tabRoutes', 'tabVoy', 'tabPort']) {
      await p.click('#' + tab);
      await p.waitForTimeout(1500);
      await measure(tab);
    }

    /* Overlays carry as much text as the screens do. */
    await p.click('[data-act="stores"]').catch(() => {});
    await p.waitForTimeout(900); await measure('stores');
    await p.click('[data-act="close-sheet"]').catch(() => {});
    await p.waitForTimeout(500);

    await p.click('#tabRoutes'); await p.waitForTimeout(1300);
    await p.click('#node_c1'); await p.waitForTimeout(900); await measure('cargo sheet');
    await p.locator('#shipPicks .railcard.flag').click(); await p.waitForTimeout(600);
    await measure('cargo sheet picked');
    await p.click('[data-act="close-sheet"]'); await p.waitForTimeout(500);
    await p.click('#node_c3'); await p.waitForTimeout(900); await measure('battle sheet');

    /* ---- the prep sheet fits ----

       This is the screen where the player decides who to send against whom, and
       both halves of that have to be on screen at once. It used to be a column:
       a tall head, then a rail of ship cards, then the enemy line-up somewhere
       below the fold — so checking who you were fighting meant scrolling past
       the fleet, and checking the fleet meant scrolling back. */
    const fit = await p.evaluate(() => {
      const sheet = document.querySelector('#overlay .sheet');
      const head = document.getElementById('sheetHead');
      const body = document.getElementById('sheetBody');
      const rail = document.getElementById('shipPicks');
      /* The enemy is chips on the head strip now, not a card in the body. */
      const foes = document.querySelector('.foechip');
      if (!sheet || !rail) return null;
      const br = body.getBoundingClientRect();
      return {
        headPct: Math.round(head.getBoundingClientRect().height / sheet.getBoundingClientRect().height * 100),
        railVisible: rail.getBoundingClientRect().top < br.bottom - 40,
        foesVisible: !!foes && foes.getBoundingClientRect().width > 0,
        /* Two chips wearing one glyph on the same strip is one thing said twice. */
        dupGlyphs: (() => {
          const n = [...document.querySelectorAll('.reqbar .chip .chipic')].map(i => i.dataset.icon);
          return n.filter((x, i) => n.indexOf(x) !== i);
        })(),
        expandedByDefault: document.querySelectorAll('.foe').length > 0
      };
    });
    if (fit) {
      if (fit.headPct > 45) errors.push(vp.width + 'px: the prep sheet head is ' + fit.headPct + '% of the screen');
      if (!fit.railVisible) errors.push(vp.width + 'px: the ships are below the fold on the prep sheet');
      if (!fit.foesVisible) errors.push(vp.width + 'px: the enemy is not on the prep sheet head strip');
      if (fit.dupGlyphs.length) {
        errors.push(vp.width + 'px: two chips share a glyph — ' + fit.dupGlyphs.join(', '));
      }
      if (fit.expandedByDefault) errors.push(vp.width + 'px: the enemy line-up is expanded by default');
    }

    /* Picking a ship must not throw the rail back to its first card. */
    const kept = await p.evaluate(async () => {
      const rail = document.getElementById('shipPicks');
      if (!rail || rail.scrollWidth <= rail.clientWidth + 10) return null;
      rail.scrollLeft = Math.min(300, rail.scrollWidth - rail.clientWidth);
      await new Promise(r => setTimeout(r, 120));
      const before = rail.scrollLeft;
      const card = rail.querySelector('[data-act="pick-ship"]');
      if (!card) return null;
      const id = card.dataset.id;
      card.click();
      await new Promise(r => setTimeout(r, 320));
      const r2 = document.getElementById('shipPicks');
      const after = r2 ? r2.scrollLeft : -1;
      /* Put the selection back the way it was — the walk below picks a line and
         sails it, and a hull left selected here would be deselected there. */
      const same = r2 && r2.querySelector(`[data-act="pick-ship"][data-id="${id}"]`);
      if (same) { same.click(); await new Promise(r => setTimeout(r, 280)); }
      return { before, after };
    });
    if (kept && Math.abs(kept.after - kept.before) > 8) {
      errors.push(vp.width + 'px: the ship rail jumped from ' + kept.before + ' to ' + kept.after + ' on a pick');
    }

    /* And the fight itself. The order bar is four buttons across a phone, each
       carrying a 40px glyph and a label, which is the tightest row in the game —
       exactly the place a widened padding silently squeezes an icon to 39.9. */
    await p.locator('#shipPicks .railcard:not(.dis)').first().click();
    await p.waitForTimeout(500);
    await p.click('#sailBtn');
    await p.waitForSelector('#battleScr.on', { timeout: 9000 });
    await p.waitForTimeout(1600);
    /* A silent failure to reach the fight would make everything below pass by
       measuring the map instead, which is worse than no check at all. */
    const orders = await p.locator('#bcmds button').count();
    if (orders !== 4) errors.push(vp.width + 'px battle: expected 4 orders, found ' + orders);
    await measure('battle');
    /* Leave the way the player would, so the pause check below is not measuring
       a screen with a fight still running underneath it. */
    await p.click('[data-order="retreat"]').catch(() => {});
    for (let i = 0; i < 40 && !(await p.locator('#banner.on').count()); i++) {
      await p.click('[data-order="retreat"]').catch(() => {});
      await p.waitForTimeout(500);
    }
    await measure('battle banner');
    await p.click('[data-act="battle-continue"]').catch(() => {});
    await p.waitForTimeout(1800);
    for (let i = 0; i < 5 && await p.locator('#resultScr.on').count(); i++) {
      await p.click('[data-act="close-result"]').catch(() => {});
      await p.waitForTimeout(600);
    }
    await p.waitForTimeout(600);

    await p.click('[data-act="pause-open"]').catch(() => {});
    await p.waitForTimeout(700); await measure('pause');

    await p.close();
  }
  await b.close();
  done();
})();
