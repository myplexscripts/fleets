/* Declarative click handling.

   Markup is generated as HTML strings all over this game. Inline `onclick`
   would force every handler to be a global, which does not work with modules —
   so buttons carry `data-act="repair" data-id="s3"` and register here:

       action('repair', d => doRepair(d.id));

   The handler gets (dataset, element, event). Works on SVG nodes too, which
   the map relies on. */

const handlers = new Map();

export function action(name, fn) { handlers.set(name, fn); }
export function actions(map) { for (const k in map) handlers.set(k, map[k]); }

export function initActions() {
  document.addEventListener('click', ev => {
    const el = ev.target.closest && ev.target.closest('[data-act]');
    if (!el) return;
    if (el.hasAttribute('disabled') || el.classList.contains('dis')) return;
    const fn = handlers.get(el.dataset.act);
    if (!fn) { console.warn('[actions] no handler for', el.dataset.act); return; }
    ev.preventDefault();
    fn(el.dataset, el, ev);
  });
}
