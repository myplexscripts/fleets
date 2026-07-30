/* Markers must be far enough apart to hit, at every stage of the game.

   The chart used to be squeezed into the viewport however many nodes it held,
   so unlocking a region made every marker smaller and closer until they were
   unhittable. It is drawn at a scale that guarantees a thumb between the two
   closest nodes now, and pans when that will not fit — this walks three stages
   of progression, measures the tightest pair, and clicks the first few markers
   to prove they are reachable where they are drawn.

   Needs playwright-core and the game served; see the README. */
let chromium = null;
for (const where of ['playwright-core', require('path').join(process.cwd(), 'node_modules', 'playwright-core')]) {
  try { chromium = require(where).chromium; break; } catch (e) { /* try the next */ }
}
const errors = [];
/* The distance the two closest markers are drawn apart at rest.

   It used to be a full thumb's width, because scaling the whole chart was the
   only way to make a crowded marker hittable — which meant one tight pair
   inflated the drawing to several screens across and the map opened onto home
   port and nothing else. Markers are now spaced apart in the chart's own
   coordinates first, and a pinch handles anything still too close, so this is
   the comfortable resting distance rather than the guarantee. */
const MIN = 64;
(async () => {
  if (!chromium) {
    console.log('skipped — needs playwright-core and the game served (see README)');
    return;
  }
  const b = await chromium.launch({
    executablePath: process.env.SP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => console.log('[pageerror] ' + e.message));
  await p.goto(process.env.SP_URL || 'http://127.0.0.1:8137/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-new"]'); await p.waitForTimeout(900);
  if (await p.locator('[data-act="tut-skip"]').count()) await p.click('[data-act="tut-skip"]');
  await p.waitForTimeout(600);

  const stages = [
    ['caribbean only', s => { s.gold = 5000; }],
    ['two regions', s => { s.unlocked = ['caribbean','gulf']; s.bossBeaten = { caribbean: true }; }],
    ['everything', s => {
      s.unlocked = ['caribbean','gulf','atlantic','grand'];
      s.bossBeaten = { caribbean: true, gulf: true };
      s.noto = { atlantic: 999, grand: 999 };
      s.ports = ['nassau','tortuga','havana','charlestowne','veracruz'];
    }]
  ];

  for (const [label, patch] of stages) {
    await p.evaluate(src => {
      const s = JSON.parse(localStorage.getItem('saltpowder'));
      (new Function('s', src))(s);
      localStorage.setItem('saltpowder', JSON.stringify(s));
    }, '(' + patch.toString() + ')(s)');
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('#titleScr.on');
    await p.click('[data-act="title-continue"]');
    await p.waitForSelector('#app.on'); await p.waitForTimeout(700);
    await p.click('#tabRoutes'); await p.waitForTimeout(1500);

    const r = await p.evaluate(() => {
      const svg = document.getElementById('mapsvg');
      const sc = document.getElementById('mapscroll');
      const nodes = [...document.querySelectorAll('#mapsvg g.mapnode')].map(g => {
        const c = g.querySelector('circle');
        return { id: g.id, x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') };
      });
      let min = Infinity, pair = '';
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
          if (d < min) { min = d; pair = nodes[a].id + ' / ' + nodes[b].id; }
        }
      }
      return {
        n: nodes.length, min: min === Infinity ? 999 : min, pair,
        hit: nodes.length ? nodes[0].r : 0,
        content: [+svg.getAttribute('width'), +svg.getAttribute('height')],
        view: [sc.clientWidth, sc.clientHeight],
        pans: sc.scrollWidth > sc.clientWidth + 2 || sc.scrollHeight > sc.clientHeight + 2
      };
    });
    console.log(label + ': ' + r.n + ' nodes, closest ' + r.min.toFixed(0) + 'px (' + r.pair + '),'
      + ' hit r=' + r.hit.toFixed(0) + ', chart ' + r.content.join('x') + ' in ' + r.view.join('x')
      + (r.pans ? ' — pans' : ''));
    if (r.n > 1 && r.min < MIN - 1) errors.push(label + ': markers only ' + r.min.toFixed(0) + 'px apart (' + r.pair + ')');
    if (r.hit < 26) errors.push(label + ': tap radius only ' + r.hit.toFixed(0));

    /* ---- the words, not just the dots ----

       Spacing the markers is only half of it. A label is far wider than the
       marker it hangs off — "CUTLASS JACK DOYLE" is several times the width of
       its own dot — so a chart with every marker comfortably apart could still
       print two names straight through each other. */
    const lbl = await p.evaluate(() => {
      const svg = document.getElementById('mapsvg');
      const ts = [...svg.querySelectorAll('.maplabels text')].map(t => {
        const r = t.getBBox();
        return { t: t.textContent.trim(), x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
      });
      const hit = [];
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i], b = ts[j];
          if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
            hit.push(`"${a.t}" x "${b.t}"`);
          }
        }
      }
      return { n: ts.length, hit };
    });
    console.log('  ' + lbl.n + ' labels, ' + (lbl.hit.length ? lbl.hit.length + ' COLLIDING' : 'none colliding'));
    if (lbl.hit.length) errors.push(label + ': labels overlap — ' + lbl.hit.join(', '));

    /* ---- bleed ----

       Pulled all the way back, the sea has to run past every edge of the window.
       A chart that stops in a straight line reads as a picture of a map rather
       than as an ocean. */
    const out = await p.evaluate(async () => {
      const sc = document.getElementById('mapscroll');
      const svg = document.getElementById('mapsvg');
      const r = sc.getBoundingClientRect();
      for (let i = 0; i < 40; i++) {
        sc.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 120, ctrlKey: true, bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
        }));
      }
      await new Promise(x => setTimeout(x, 250));
      const s = svg.getBoundingClientRect();
      return {
        left: Math.round(s.left - r.left), right: Math.round(r.right - s.right),
        top: Math.round(s.top - r.top), bottom: Math.round(r.bottom - s.bottom)
      };
    });
    const gaps = ['left', 'right', 'top', 'bottom'].filter(k => out[k] > 0);
    console.log('  zoomed out: ' + (gaps.length ? 'EDGE SHOWS on ' + gaps.join(', ') : 'sea past every edge'));
    gaps.forEach(k => errors.push(`${label}: the chart's ${k} edge shows when zoomed out (${out[k]}px)`));
    await p.evaluate(async () => {
      const m = await import('/src/ui/screens/map.js');
      m.resetZoom();
    });
    await p.click('#tabFleet'); await p.waitForTimeout(300);
    await p.click('#tabRoutes'); await p.waitForTimeout(900);

    /* Every node must actually be clickable where it is drawn. */
    const ids = await p.locator('#mapsvg g.mapnode').evaluateAll(g => g.map(x => x.id));
    for (const id of ids.slice(0, 4)) {
      try {
        await p.locator('#' + id).click({ timeout: 4000 });
        await p.waitForTimeout(350);
        if (!(await p.locator('#overlay.vis').count())) errors.push(label + ': ' + id + ' opened nothing');
        await p.keyboard.press('Escape'); await p.waitForTimeout(350);
      } catch (e) { errors.push(label + ': ' + id + ' not clickable'); }
    }
  }
  await b.close();
  errors.forEach(e => console.log(' * ' + e));
  console.log(errors.length ? '=== ' + errors.length + ' problem(s) ===' : 'every marker is reachable');
  process.exit(errors.length ? 1 : 0);
})();
