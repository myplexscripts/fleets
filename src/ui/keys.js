/* Keyboard control.

   Not an accessibility afterthought — being playable without touching the
   mouse is part of what makes this feel like a game on a desktop. */

import { $ } from '../core/dom.js';
import { dialogOpen, dialogKey } from './dialog.js';
import { pauseOpen, togglePause, closePause } from './pause.js';
import { sheetOpen, closeSheet } from './sheet.js';
import { SCREENS, gotoTab } from './shell.js';
import { onTitle } from './title.js';
import { ORDERS, bannerOpen } from '../battle/hud.js';
import { cmd, endBattle, cycleTarget, battleOpen } from '../battle/loop.js';
import { BT } from '../battle/state.js';

function click(sel) {
  const el = $(sel);
  if (el) el.click();
}

export function initKeys() {
  addEventListener('keydown', ev => {
    /* Never hijack typing. */
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (dialogOpen()) dialogKey(ev);
      return;
    }
    if (dialogOpen()) { dialogKey(ev); ev.preventDefault(); return; }

    const k = ev.key;

    /* Title screen: Enter takes the first menu button. */
    if (onTitle()) {
      if (pauseOpen()) { if (k === 'Escape') closePause(); return; }
      if (k === 'Enter' || k === ' ') {
        const b = document.querySelector('#titleScr .menubtn.primary') || document.querySelector('#titleScr .menubtn');
        if (b) { b.click(); ev.preventDefault(); }
      }
      return;
    }

    if (pauseOpen()) {
      if (k === 'Escape' || k === 'p' || k === 'P') { closePause(); ev.preventDefault(); }
      return;
    }

    /* Battle. */
    if (battleOpen()) {
      if (bannerOpen()) {
        if (k === 'Enter' || k === ' ') {
          const b = document.querySelector('#banner [data-act="battle-continue"]');
          if (b) { endBattle(b.dataset.kind); ev.preventDefault(); }
        }
        return;
      }
      const order = ORDERS.find(o => o.hot === k);
      if (order) { cmd(order.id); ev.preventDefault(); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab') { cycleTarget(1); ev.preventDefault(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { cycleTarget(-1); ev.preventDefault(); return; }
      if (k === 'Escape' && !BT.busy) { togglePause(); ev.preventDefault(); }
      return;
    }

    /* Mission or result sheet. */
    if (sheetOpen()) {
      if (k === 'Escape') { closeSheet(); ev.preventDefault(); return; }
      if (k === 'Enter') { click('sailBtn'); ev.preventDefault(); return; }
      return;
    }

    /* Main game: number keys switch screens, Esc pauses. */
    if (k === 'Escape' || k === 'p' || k === 'P') { togglePause(); ev.preventDefault(); return; }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= SCREENS.length) { gotoTab(SCREENS[n - 1].key); ev.preventDefault(); }
  });
}
