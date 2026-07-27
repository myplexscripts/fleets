/* Pause / options menu, reached from the ship's wheel in the top bar or Esc.

   This is where everything a game is expected to have but a web page is not
   lives: audio, motion, haptics, fullscreen, replaying the tutorial, and the
   way back out to the title. */

import { $, reflow } from '../core/dom.js';
import { S, newGame, save } from '../core/state.js';
import { actions } from '../core/actions.js';
import { settings, toggleSetting } from '../core/settings.js';
import { iconHTML } from '../art/icons.js';
import { ambience, play } from '../fx/sound.js';
import { toast } from '../fx/toast.js';
import { confirmDlg } from './dialog.js';
import { restartTut } from './tutorial.js';
import { returnToTitle, enterGame } from './title.js';

const TOGGLES = [
  { key: 'sfx',     label: 'Sound Effects' },
  { key: 'music',   label: 'Sea Ambience' },
  { key: 'haptics', label: 'Vibration' },
  { key: 'shake',   label: 'Screen Shake' },
  { key: 'motion',  label: 'Background Motion' }
];

export const pauseOpen = () => $('pauseScr').classList.contains('on');

function fullscreenSupported() {
  return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
}

function draw() {
  const inFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
  $('pauseScr').innerHTML = `
    <div class="pausebox">
      <div class="pausehead">${iconHTML('wheel', 40)}<span>Ship's Orders</span></div>
      <div class="pausebody">
        <div class="optlist">
          ${TOGGLES.map(t => `
            <button class="optrow" data-act="pause-toggle" data-key="${t.key}">
              <span>${t.label}</span>
              <span class="sw ${settings[t.key] ? 'on' : ''}"><i></i></span>
            </button>`).join('')}
          ${fullscreenSupported() ? `
            <button class="optrow" data-act="pause-fullscreen">
              <span>Fullscreen</span><span class="optval">${inFull ? 'On' : 'Off'}</span>
            </button>` : ''}
        </div>
        <div class="optsect">Logbook</div>
        <div class="optlist">
          <button class="optrow" data-act="pause-tutorial"><span>Replay Tutorial</span><span class="optval">›</span></button>
          <button class="optrow" data-act="pause-newgame"><span>Abandon &amp; Start Over</span><span class="optval danger">›</span></button>
          <button class="optrow" data-act="pause-title"><span>Return to Title</span><span class="optval">›</span></button>
        </div>
      </div>
      <div class="pausefoot">
        <button class="btn gold wide" data-act="pause-close">Back to the Helm</button>
      </div>
    </div>`;
}

export function openPause() {
  const el = $('pauseScr');
  draw();
  el.classList.add('on');
  reflow(el);
  el.classList.add('vis');
  play('ui_tap');
}

export function closePause() {
  const el = $('pauseScr');
  el.classList.remove('vis');
  setTimeout(() => el.classList.remove('on'), 260);
}

export function togglePause() {
  if (pauseOpen()) closePause(); else openPause();
}

function onToggle(key) {
  const val = toggleSetting(key);
  draw();
  if (key === 'music') ambience(val && $('battleScr').classList.contains('on'));
  if (key === 'sfx' && val) play('ui_tap');
}

async function toggleFullscreen() {
  try {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    } else {
      await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen());
    }
  } catch (e) {
    toast('This browser would not go fullscreen.', 'bad');
  }
  setTimeout(draw, 120);
}

async function doRestartTutorial() {
  const ok = await confirmDlg({
    title: 'Run the Tutorial Again?',
    text: 'The onboarding steps start over from the beginning. Your fleet and progress are untouched.',
    ok: 'Replay', cancel: 'No Need'
  });
  if (!ok) return;
  closePause();
  restartTut();
  toast('Tutorial restarted.', 'blu');
}

async function doNewGame() {
  const ok = await confirmDlg({
    title: 'Abandon This Fleet?',
    text: 'Every ship, port, collectible and admiral you have beaten is struck from the record, and you begin again with 500 gold.',
    ok: 'Start Over', cancel: 'Belay That', danger: true
  });
  if (!ok) return;
  closePause();
  newGame();
  enterGame();
  toast('A new logbook, and the same ocean.', 'gold');
}

async function doReturnToTitle() {
  if (S) save();
  closePause();
  returnToTitle();
}

actions({
  'pause-open': openPause,
  'pause-close': closePause,
  'pause-toggle': d => onToggle(d.key),
  'pause-fullscreen': toggleFullscreen,
  'pause-tutorial': doRestartTutorial,
  'pause-newgame': doNewGame,
  'pause-title': doReturnToTitle
});
