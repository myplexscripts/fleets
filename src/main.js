/* Boot.

   Load order matters only in that modules with side effects (action handlers)
   must be imported before anything can click them — so they are all pulled in
   here, at the top level. */

import { loadSettings } from './core/settings.js';
import { initActions } from './core/actions.js';
import { loadShipArt, artStepCount } from './art/ships.js';
import { loadIconArt } from './art/icons.js';
import { initSound } from './fx/sound.js';
import { initMist } from './fx/mist.js';
import { buildNav, startTicker } from './ui/shell.js';
import { initTutorial } from './ui/tutorial.js';
import { initKeys } from './ui/keys.js';
import { initLoading, loadStep, hideLoading } from './ui/loading.js';
import { showTitle } from './ui/title.js';
import './ui/pause.js';
import './ui/mission.js';
import './ui/stores.js';

const LOAD_MSGS = [
  'Bending on sail…',
  'Counting the powder…',
  'Reading the chart…',
  'Waking the crew…'
];

async function boot() {
  loadSettings();
  initActions();
  initSound();
  initMist();
  initTutorial();
  initKeys();

  initLoading(artStepCount + 2);

  let i = 0;
  await Promise.all([
    loadShipArt(() => loadStep(LOAD_MSGS[(i++) % LOAD_MSGS.length])),
    loadIconArt()
  ]);
  loadStep('Making the ship ready…');

  buildNav();
  loadStep('All hands.');

  startTicker();
  hideLoading();
  showTitle();
}

/* A long-press context menu breaks the illusion on touch devices. */
document.addEventListener('contextmenu', ev => {
  if (!ev.target.closest('input,textarea')) ev.preventDefault();
});

boot().catch(err => {
  console.error('[boot]', err);
  document.body.innerHTML =
    '<div style="padding:24px;font-family:system-ui;color:#cfe3e4">' +
    'Salt &amp; Powder failed to start. Check the console.</div>';
});
