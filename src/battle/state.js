/* Live battle state, shared by the loop, the scene and the battle HUD. */

export const BT = {
  b: null,        // the current engagement
  scene: null,    // the Phaser scene, once it has booted
  busy: false     // an order is resolving; input is locked
};

/* Does the current boss have this gimmick? */
export function gim(k) {
  return !!(BT.b && BT.b.boss && BT.b.boss.gimmicks.includes(k));
}

export const aliveE = () => BT.b.enemies.filter(e => !e.disabled);
export const aliveP = () => BT.b.fleet.filter(s => s.hull > 0);
