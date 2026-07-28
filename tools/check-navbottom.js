/* Nothing sits below the nav rail, and nothing sits below the tabs.

   On a phone with a home indicator, env(safe-area-inset-bottom) is around 34px.
   If that inset is spent as padding *under* the tab buttons, the rail still
   reaches the bottom of the screen but the last 40-odd pixels of it are plain
   gradient — a strip of dead space along the bottom of every screen in the
   game. The fix is to carry the inset inside the buttons instead, so the tab
   faces run all the way to the edge.

   This checks both halves: the rail reaches the viewport bottom, and the tab
   faces reach the bottom of the rail — first with no inset, then again with a
   34px inset simulated, because headless Chromium never reports one.

   Run:  node tools/check-navbottom.js [url]
   Needs playwright-core and a server on the url (default :8137). */

const URL = process.argv[2] || 'http://127.0.0.1:8137/index.html';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const INSET = 34;          // iPhone home indicator, portrait

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (e) {
  console.error('check-navbottom: playwright-core is not installed — cannot verify.');
  console.error('  npm i -D playwright-core, then re-run.');
  process.exit(2);
}

/* iOS resolves env() itself; nothing in a desktop browser will. Restating the
   two rules with a literal inset is the closest honest simulation. */
const SIM = `
  nav{padding-bottom:0!important}
  nav button{
    padding-bottom:${INSET + 8}px!important;
    min-height:${60 + INSET}px!important;
  }`;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#titleScr.on');
  await p.click('[data-act="title-new"]');
  await p.waitForSelector('#app.on');
  await p.waitForTimeout(700);

  const bad = [];

  for (const inset of [0, INSET]) {
    if (inset) await p.addStyleTag({ content: SIM });
    await p.waitForTimeout(120);

    const m = await p.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; };
      const nav = document.getElementById('nav');
      const btns = [...nav.querySelectorAll('button')];
      return {
        vh: innerHeight,
        nav: r(nav),
        lowestTab: Math.max(...btns.map(x => r(x).bottom)),
        tabs: btns.length
      };
    });

    const underRail = +(m.vh - m.nav.bottom).toFixed(1);
    const underTabs = +(m.nav.bottom - m.lowestTab).toFixed(1);
    const tag = inset ? `inset ${inset}px` : 'no inset';

    if (underRail > 0.5) bad.push(`[${tag}] ${underRail}px of screen below the nav rail`);
    if (underTabs > 0.5) bad.push(`[${tag}] ${underTabs}px of dead rail below the tab faces`);
    console.log(`${tag}: rail ends at ${m.nav.bottom.toFixed(0)}/${m.vh}, `
      + `${m.tabs} tabs end at ${m.lowestTab.toFixed(0)} — `
      + `${underRail}px under rail, ${underTabs}px under tabs`);
  }

  await b.close();

  if (bad.length) {
    console.error('\ncheck-navbottom FAILED');
    bad.forEach(l => console.error('  ' + l));
    process.exit(1);
  }
  console.log('\ncheck-navbottom OK — the rail and its tabs both reach the screen edge.');
})();
