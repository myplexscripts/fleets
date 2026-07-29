/* Title screen. The first thing you see, and the thing that makes this read as
   a game rather than a page that happens to contain one. */

import { $ } from '../core/dom.js';
import { S, newGame, load, hasSave, save } from '../core/state.js';
import { actions } from '../core/actions.js';
import { SAVE_KEY } from '../core/config.js';
import { TITLE_LINES } from '../data/flavour.js';
import { REGIONS } from '../data/world.js';
import { shipHTML } from '../art/ships.js';
import { iconHTML } from '../art/icons.js';
import { pick } from '../core/rng.js';
import { wipe } from '../fx/wipe.js';
import { play, ambience } from '../fx/sound.js';
import { confirmDlg } from './dialog.js';
import { render, resetTicker } from './shell.js';
import { ensureDives } from '../core/dives.js';
import { refreshTut } from './tutorial.js';

export const onTitle = () => $('titleScr').classList.contains('on');

export function showTitle() {
  const saved = hasSave();
  let progress = '';

  /* If there is a save, show what it amounts to — a reason to hit Continue. */
  if (saved) {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      const beaten = Object.keys(d.bossBeaten || {}).length;
      const region = (d.unlocked || []).slice(-1)[0];
      progress = `<div class="tprogress">
        <span>${iconHTML('gold', 40)}${d.gold | 0}</span>
        <span>${iconHTML('anchor', 40)}${(d.ships || []).length} ship${(d.ships || []).length === 1 ? '' : 's'}</span>
        <span>${iconHTML('star', 40)}${beaten}/4 admirals</span>
        ${region && REGIONS[region] ? `<span>${iconHTML('map', 40)}${REGIONS[region].n}</span>` : ''}
      </div>`;
    } catch (e) { progress = ''; }
  }

  $('titleScr').innerHTML = `
    <div class="tsky"></div>
    <div class="tsea"></div>
    <div class="tinner">
      <div class="twordmark">
        <span class="tw1">Salt</span><span class="tamp">&amp;</span><span class="tw2">Powder</span>
      </div>
      <div class="trule"></div>
      <div class="tline">${pick(TITLE_LINES)}</div>
      <div class="tship">${shipHTML('flagship', 'flag', 3.1)}</div>
      ${progress}
      <div class="tmenu">
        ${saved ? '<button class="menubtn primary" data-act="title-continue">Continue Voyage</button>' : ''}
        <button class="menubtn ${saved ? '' : 'primary'}" data-act="title-new">New Game</button>
        <button class="menubtn small" data-act="pause-open">Options</button>
      </div>
      <div class="tfoot">Build the most feared fleet in the Caribbean</div>
    </div>`;

  $('titleScr').classList.add('on');
  $('app').classList.remove('on');
  document.body.classList.add('titlemode');
  play('theme');
}

/* Leave the title and hand control to the game shell. */
export function enterGame() {
  /* Chart the wrecks up front. allRoutes() would do it the first time the map
     is drawn, but a save whose contents depend on which screen you happened to
     open is a save that will surprise somebody later. */
  ensureDives();
  wipe(() => {
    $('titleScr').classList.remove('on');
    $('app').classList.add('on');
    document.body.classList.remove('titlemode');
    render();
    resetTicker();
    refreshTut();
  });
}

function titleContinue() {
  if (!load()) { newGame(); }
  enterGame();
}

async function titleNew() {
  if (hasSave()) {
    const ok = await confirmDlg({
      title: 'Scuttle the Old Save?',
      text: 'Starting a new game throws away the fleet you already have. There is only one logbook.',
      ok: 'Start Over', cancel: 'Cancel', danger: true
    });
    if (!ok) return;
  }
  newGame();
  enterGame();
}

/* Reachable from the pause menu without importing it back. */
export function returnToTitle() {
  if (S) save();
  ambience(false);
  wipe(() => {
    $('app').classList.remove('on');
    showTitle();
  });
}

actions({
  'title-continue': titleContinue,
  'title-new': titleNew
});
