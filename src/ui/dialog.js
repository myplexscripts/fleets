/* In-world modal dialogs.

   Replaces window.confirm / window.prompt — a browser chrome dialog is the
   single loudest signal that something is a web page rather than a game. */

import { $, esc, reflow } from '../core/dom.js';
import { play } from '../fx/sound.js';

let open = null;   // { resolve, kind }

function host() {
  let el = $('dialogs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dialogs';
    document.body.appendChild(el);
  }
  return el;
}

function close(result) {
  if (!open) return;
  const { resolve } = open;
  open = null;
  const h = host();
  const box = h.querySelector('.dlg');
  h.classList.remove('vis');
  if (box) box.classList.add('out');
  setTimeout(() => { h.innerHTML = ''; h.classList.remove('on'); }, 240);
  resolve(result);
}

function show(kind, opts) {
  if (open) close(kind === 'prompt' ? null : false);
  const h = host();
  const isPrompt = kind === 'prompt';
  const okLabel = opts.ok || (kind === 'alert' ? 'Aye' : 'Confirm');
  h.innerHTML = `
    <div class="dlg ${opts.danger ? 'danger' : ''}" role="dialog" aria-modal="true">
      <div class="dlg-head">${esc(opts.title || '')}</div>
      <div class="dlg-body">
        ${opts.text ? `<p>${esc(opts.text)}</p>` : ''}
        ${opts.chips || ''}
        ${isPrompt ? `<input id="dlgInput" class="dlg-input" maxlength="${opts.max || 20}"
            value="${esc(opts.value || '')}" spellcheck="false" autocomplete="off">` : ''}
      </div>
      <div class="dlg-foot">
        ${kind === 'alert' ? '' : `<button class="btn sm quiet" data-dlg="cancel">${esc(opts.cancel || 'Belay')}</button>`}
        <button class="btn sm ${opts.danger ? 'red' : 'gold'}" data-dlg="ok">${esc(okLabel)}</button>
      </div>
    </div>`;
  h.classList.add('on');
  reflow(h);
  h.classList.add('vis');
  play('ui_tap');

  h.onclick = ev => {
    const b = ev.target.closest('[data-dlg]');
    if (b) {
      if (b.dataset.dlg === 'ok') {
        const inp = $('dlgInput');
        close(isPrompt ? (inp ? inp.value : '') : true);
      } else close(isPrompt ? null : false);
      return;
    }
    if (ev.target === h) close(isPrompt ? null : false);   // click the scrim
  };

  const inp = $('dlgInput');
  if (inp) {
    setTimeout(() => { inp.focus(); inp.select(); }, 60);
    inp.onkeydown = ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); close(inp.value); }
    };
  } else {
    setTimeout(() => { const b = h.querySelector('[data-dlg="ok"]'); if (b) b.focus(); }, 60);
  }

  return new Promise(resolve => { open = { resolve, kind }; });
}

export const confirmDlg = opts => show('confirm', opts);
export const promptDlg = opts => show('prompt', opts);
export const alertDlg = opts => show('alert', opts);

export const dialogOpen = () => !!open;

/* Called by the global key handler. */
export function dialogKey(ev) {
  if (!open) return false;
  if (ev.key === 'Escape') { close(open.kind === 'prompt' ? null : false); return true; }
  if (ev.key === 'Enter' && open.kind !== 'prompt') {
    close(open.kind === 'alert' ? undefined : true);
    return true;
  }
  return true;   // swallow everything else while a dialog is up
}
