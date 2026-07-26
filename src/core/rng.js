/* Random helpers. Centralised so a seeded RNG could be dropped in later. */

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;
export const shuffled = arr => arr.slice().sort(() => Math.random() - 0.5);

/* Fill %s / %d placeholders in a flavour-text template. */
export function fx(tpl, ...a) {
  let i = 0;
  return tpl.replace(/%[sd]/g, () => a[i++]);
}
