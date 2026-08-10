/* The game's display face, spelled out for Phaser: canvas text cannot
   inherit a CSS custom property, and the fallback chain matters because a
   missing family here is a serif in the middle of the fight. */
const BATTLE_FONT = "Staatliches, 'Arial Narrow', Impact, sans-serif";

/* The Phaser battle scene: ships, cannon fire, smoke, sinking.

   All of it is drawn from two generated textures ('px' a white square, 'soft' a
   radial gradient) plus the baked ship canvases, so there are no image assets
   to ship and nothing to fail to load. */

import { SHIPCFG } from '../data/ships.js';
import { SHIP_CANVAS, SHIP_DIM } from '../art/ships.js';
import { rnd } from '../core/rng.js';
import { settings } from '../core/settings.js';
import { play } from '../fx/sound.js';
import { BT, reloadOf } from './state.js';

/* Resolve the base class at load time instead of writing `extends Phaser.Scene`
   directly: a class heritage clause is evaluated when the module loads, so a
   missing Phaser would throw before boot and take the whole game down. With a
   stub base the module still loads, this class is simply never instantiated,
   and the battle loop falls back to resolving fights as text. */
const SceneBase = (typeof Phaser !== 'undefined' && Phaser.Scene)
  ? Phaser.Scene
  : class { constructor() {} };

export const phaserReady = () => typeof Phaser !== 'undefined' && !!Phaser.Scene;

export class BattleScene extends SceneBase {
  constructor() { super('battle'); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
      g.generateTexture('px', 4, 4);
      g.destroy();
    }
    if (!this.textures.exists('soft')) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const c2 = cv.getContext('2d');
      const gr = c2.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c2.fillStyle = gr;
      c2.fillRect(0, 0, 128, 128);
      this.textures.addCanvas('soft', cv);
    }
    Object.keys(SHIP_CANVAS).forEach(k => {
      if (!this.textures.exists('ship_' + k)) this.textures.addCanvas('ship_' + k, SHIP_CANVAS[k]);
    });

    /* Drifting fog, tinted red for an admiral. */
    const fogTint = BT.b.boss ? 0xe08070 : 0x78e0e8;
    for (let i = 0; i < 7; i++) {
      const f = this.add.image(Math.random() * W, Math.random() * H, 'soft')
        .setScale(rnd(3, 6)).setAlpha(rnd(0.04, 0.09)).setTint(fogTint).setDepth(0);
      if (settings.motion) {
        this.tweens.add({
          targets: f, x: f.x + rnd(-120, 120), y: f.y + rnd(-60, 60),
          duration: rnd(9000, 16000), yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
      }
    }

    this.ships = [];
    this.marker = null;
    this.buildFleets();
    BT.scene = this;
    this.events.on('shutdown', () => { if (BT.scene === this) BT.scene = null; });
  }

  shipScale() {
    const m = Math.min(this.scale.width, this.scale.height);
    return m < 430 ? 0.62 : (m > 760 ? 1.05 : 0.82);
  }

  /* Lay a column of n ships out down a band of the screen. Spacing is capped so
     a two-ship line stays a line instead of drifting to opposite ends of a tall
     phone screen, and a five-ship line still fits a short one.

     The band is not the whole canvas. Every hull carries a nameplate, a hull bar
     and a reload meter below her, and the running log floats over the bottom of
     the water — so the rearmost ship in a three-ship line has to be lifted clear
     of both or her meter ends up underneath the text. */
  lanes(n, H, top, bot) {
    const band = Math.max(80, H - top - bot);
    const mid = top + band / 2;
    if (n <= 1) return [mid];
    const gap = Math.min(band / (n - 1), 210);
    return Array.from({ length: n }, (_, i) => mid - (gap * (n - 1)) / 2 + gap * i);
  }

  /* How far below a hull's centre her furniture reaches: the deepest sprite in
     this fight, plus the plate, the hull bar and the reload meter under it. */
  footRoom(s) {
    const hs = Object.keys(SHIP_DIM).map(k => SHIP_DIM[k].h);
    const tall = hs.length ? Math.max(...hs) : 150;
    return tall * s * 0.75 + 36;
  }

  buildFleets() {
    const b = BT.b, W = this.scale.width, H = this.scale.height, s = this.shipScale();

    /* Keep hulls clear of the screen edges: the widest sprite is a man o' war,
       so inset by half of that plus a margin. */
    const inset = Math.min(W * 0.30, 70 + 130 * s);
    const px = inset, ex = W - inset;

    /* The log is two lines of italic over a fade, pinned to the bottom of the
       water. Both lines have to sit above it. */
    const LOG_BAND = 84;
    const foot = this.footRoom(s);
    const py = this.lanes(b.fleet.length, H, 18, foot + LOG_BAND);
    const ey = this.lanes(b.enemies.length, H, 18, foot + LOG_BAND);

    b.fleet.forEach((sh, i) =>
      this.addShip(sh, sh.id === 'FLAG' ? 'flag' : 'player', px, py[i], true, s));
    if (b.merchant) this.addShip(b.merchant, 'merchant', W * 0.42, H * 0.06 + 30, true, s * 0.9);
    b.enemies.forEach((e, i) =>
      this.addShip(e, e.pal || 'enemy', ex, ey[i], false, s * (e.isBoss ? 1.15 : 1)));

    this.setMarker(0);

    /* Both lines sail in from off-screen. */
    this.ships.forEach((o, i) => {
      const tx = o.c.x;
      o.c.x += o.facingRight ? -W * 0.5 : W * 0.5;
      o.c.alpha = 0;
      this.tweens.add({ targets: o.c, x: tx, alpha: 1, delay: i * 110, duration: 600, ease: 'Cubic.out' });
    });
  }

  addShip(data, pal, x, y, facingRight, scale) {
    const type = SHIPCFG[data.type] ? data.type : 'brig';
    let key = type + '_' + pal;
    if (!SHIP_CANVAS[key]) key = type + '_enemy';
    const dim = SHIP_DIM[key];

    const c = this.add.container(x, y).setDepth(data.isBoss ? 3 : 2);
    const img = this.add.image(0, 0, 'ship_' + key).setDisplaySize(dim.w * scale * 1.5, dim.h * scale * 1.5);
    img.setFlipX(!!facingRight);

    const pw = Math.max(110, dim.w * scale * 1.4);
    const plate = this.add.rectangle(0, dim.h * scale * 0.75 + 16, pw, 28, 0x07161b, 0.92)
      .setStrokeStyle(1, data.isBoss ? 0x8a463e : 0x164a52);
    const nm = this.add.text(0, dim.h * scale * 0.75 + 9, data.name.toUpperCase(),
      { fontFamily: BATTLE_FONT, fontSize: '14px', color: data.isBoss ? '#E07A6A' : '#6CB7B2' }).setOrigin(0.5, 0.5);
    const hp = this.add.graphics();
    /* Her reload, under her hull bar. This is the clock the whole fight runs
       on, so it belongs on the ship rather than in a panel somewhere. */
    const rl = this.add.graphics();
    c.add([img, plate, nm, hp, rl]);

    const o = {
      c, img, hp, rl, data, pal, facingRight, scale, dim, pw,
      bobT: this.tweens.add({
        targets: c, y: y + rnd(3, 6), duration: rnd(1600, 2400),
        yoyo: true, repeat: -1, ease: 'Sine.inOut'
      })
    };
    this.drawHp(o);
    this.drawReload(o);

    if (pal === 'enemy' || pal === 'boss') {
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
        if (!data.disabled && !BT.busy) {
          BT.b.target = BT.b.enemies.indexOf(data);
          this.setMarker(BT.b.target);
          play('ui_tap');
        }
      });
    }

    this.ships.push(o);
    return o;
  }

  find(data) { return this.ships.find(o => o.data === data); }

  drawHp(o) {
    const g = o.hp;
    g.clear();
    const y = o.dim.h * o.scale * 0.75 + 23, w = o.pw - 16;
    const p = Math.max(0, o.data.hull / o.data.max);
    g.fillStyle(0x03181c).fillRect(-w / 2, y, w, 4);
    g.fillStyle(p < 0.26 ? 0xd94a3a : (p < 0.6 ? 0xd9c34a : 0x63c06a)).fillRect(-w / 2, y, w * p, 4);
  }

  /* How close she is to firing again. Gold for yours, red for theirs, and it
     goes bright at the top of the sweep so a broadside is telegraphed by half a
     second of colour rather than arriving out of nowhere. */
  drawReload(o) {
    const g = o.rl;
    if (!g) return;
    g.clear();
    const dead = o.pal === 'player' || o.pal === 'flag' ? o.data.hull <= 0 : o.data.disabled;
    if (dead || o.pal === 'merchant') return;

    const y = o.dim.h * o.scale * 0.75 + 29, w = o.pw - 16;
    const p = Math.max(0, Math.min(1, reloadOf(o.data)));
    const mine = o.pal === 'player' || o.pal === 'flag';
    const col = p > 0.86 ? (mine ? 0xefe3ae : 0xff9080) : (mine ? 0x8a793e : 0x8a463e);
    g.fillStyle(0x03181c, 0.9).fillRect(-w / 2, y, w, 3);
    g.fillStyle(col).fillRect(-w / 2, y, w * p, 3);
  }

  /* Called from the battle clock, every frame. */
  drawReloads() {
    this.ships.forEach(o => this.drawReload(o));
  }

  setMarker(i) {
    const e = BT.b.enemies[i];
    if (!e) return;
    const o = this.find(e);
    if (!o) return;
    if (this.marker) this.marker.destroy();
    this.marker = this.add.image(o.c.x, o.c.y - o.dim.h * o.scale * 0.75 - 16, 'soft')
      .setScale(0.4).setTint(0xd94a3a).setDepth(4);
    this.tweens.add({ targets: this.marker, scale: 0.56, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.markerHome = o;
  }

  update() {
    if (this.marker && this.markerHome) {
      this.marker.x = this.markerHome.c.x;
      this.marker.y = this.markerHome.c.y - this.markerHome.dim.h * this.markerHome.scale * 0.75 - 16;
    }
  }

  shake(dur, amt) {
    if (settings.shake) this.cameras.main.shake(dur, amt);
  }

  muzzle(x, y, dir) {
    const m = this.add.image(x, y, 'soft').setScale(0.28).setTint(0xffd080)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.tweens.add({ targets: m, scale: 0.7, alpha: 0, duration: 180, onComplete: () => m.destroy() });
    const e = this.add.particles(x, y, 'px', {
      speed: { min: 30, max: 90 },
      angle: dir > 0 ? { min: -25, max: 25 } : { min: 155, max: 205 },
      lifespan: 350, quantity: 6, scale: { start: 1.2, end: 0 },
      tint: [0xaaaaaa, 0x777777], emitting: false
    }).setDepth(5);
    e.explode(6);
    this.time.delayedCall(500, () => e.destroy());
  }

  impact(x, y, dmg, big) {
    const e = this.add.particles(x, y, 'px', {
      speed: { min: 70, max: big ? 280 : 170 }, lifespan: big ? 550 : 380,
      quantity: big ? 28 : 14, scale: { start: 1.6, end: 0 },
      tint: [0xffd080, 0xff8040, 0x8a5a30], emitting: false
    }).setDepth(6);
    e.explode(big ? 28 : 14);
    this.time.delayedCall(700, () => e.destroy());

    const fl = this.add.image(x, y, 'soft').setScale(big ? 0.95 : 0.5).setTint(0xffb060)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
    this.tweens.add({ targets: fl, scale: fl.scale * 2, alpha: 0, duration: 260, onComplete: () => fl.destroy() });

    this.floatText(x, y - 26, '-' + dmg, big ? '#D49A3A' : '#E2D6B6', big ? 28 : 22);
    this.shake(big ? 200 : 120, big ? 0.012 : 0.006);
    play(big ? 'explosion' : 'impact');
  }

  floatText(x, y, txt, color, size) {
    const t = this.add.text(x, y, txt, {
      fontFamily: BATTLE_FONT, fontSize: (size || 20) + 'px', color, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  flash(color) {
    const r = this.add.rectangle(this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, color, 0.55).setDepth(9);
    this.tweens.add({ targets: r, alpha: 0, duration: 420, onComplete: () => r.destroy() });
  }

  /* Resolves once the shot lands, so the loop can await the visual. */
  fireShot(from, to, barrel, huge) {
    return new Promise(res => {
      const fo = this.find(from), to_ = this.find(to);
      if (!fo || !to_) { res(); return; }

      const dir = fo.c.x < to_.c.x ? 1 : -1;
      const sx = fo.c.x + dir * fo.dim.w * fo.scale * 0.68, sy = fo.c.y;
      this.muzzle(sx, sy, dir);
      if (huge) { this.muzzle(sx, sy - 18, dir); this.muzzle(sx, sy + 18, dir); }
      play('cannon');
      this.tweens.add({ targets: fo.c, x: fo.c.x - dir * (huge ? 16 : 7), duration: huge ? 140 : 80, yoyo: true });

      const ball = this.add.image(sx, sy, (barrel || huge) ? 'soft' : 'px')
        .setScale(huge ? 0.4 : (barrel ? 0.22 : 1.8))
        .setTint(huge ? 0xff5030 : (barrel ? 0xff7030 : 0x222222)).setDepth(6);
      if (barrel || huge) {
        ball.setBlendMode(Phaser.BlendModes.ADD);
        ball._trail = this.add.particles(0, 0, 'px', {
          follow: ball, speed: 15, lifespan: 300, quantity: 2, frequency: 20,
          scale: { start: huge ? 1.6 : 1, end: 0 }, tint: [0xff8040, 0xffc060], emitting: true
        }).setDepth(5);
      }

      const ex = to_.c.x - dir * to_.dim.w * to_.scale * 0.3, ey = to_.c.y + rnd(-8, 8);
      const mx = (sx + ex) / 2, peak = Math.min(sy, ey) - rnd(40, 80);
      const tw = { t: 0 };
      this.tweens.add({
        targets: tw, t: 1, duration: huge ? 620 : (barrel ? 520 : 400), ease: 'Sine.in',
        onUpdate: () => {
          const t = tw.t;
          ball.x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
          ball.y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * peak + t * t * ey;
        },
        onComplete: () => {
          if (ball._trail) ball._trail.destroy();
          ball.destroy();
          res({ x: ex, y: ey, o: to_ });
        }
      });
    });
  }

  hitFlash(o) {
    this.tweens.addCounter({
      from: 0, to: 1, duration: 120, yoyo: true,
      onUpdate: tw => o.img.setTintFill(0xffffff).setAlpha(1 - tw.getValue() * 0.3),
      onComplete: () => { o.img.clearTint(); o.img.setAlpha(1); }
    });
    this.tweens.add({ targets: o.c, x: o.c.x + rnd(-5, 5), duration: 60, yoyo: true, repeat: 2 });
  }

  sink(o) {
    if (!o) return;
    o.bobT.stop();
    play('splash');
    this.tweens.add({
      targets: o.c, angle: o.facingRight ? -11 : 11, y: o.c.y + 26, alpha: 0.55,
      duration: 900, ease: 'Cubic.in'
    });
    o._flames = this.add.particles(o.c.x, o.c.y - o.dim.h * o.scale * 0.4, 'px', {
      speedY: { min: -40, max: -15 }, speedX: { min: -10, max: 10 },
      lifespan: 700, quantity: 2, frequency: 110, scale: { start: 1.3, end: 0 },
      tint: [0xff8040, 0xffc060, 0x555555], emitting: true
    }).setDepth(5);
    const bub = this.add.particles(o.c.x, o.c.y + o.dim.h * o.scale * 0.4, 'px', {
      speedY: { min: -30, max: -10 }, lifespan: 600, quantity: 8,
      scale: { start: 1, end: 0 }, tint: 0x9fd8e0, emitting: false
    }).setDepth(1);
    bub.explode(10);
    this.time.delayedCall(800, () => bub.destroy());
  }

  shieldPulse() {
    BT.b.fleet.forEach(s => {
      const o = this.find(s);
      if (!o || s.hull <= 0) return;
      const sh = this.add.image(o.c.x, o.c.y, 'soft').setScale(1.2).setTint(0x78d0e0)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(4);
      this.tweens.add({ targets: sh, scale: 1.7, alpha: 0, duration: 700, onComplete: () => sh.destroy() });
    });
  }

  telegraphFx() {
    const bs = BT.b.enemies.find(e => e.isBoss && !e.disabled);
    if (!bs) return;
    const o = this.find(bs);
    if (!o) return;
    play('telegraph');
    this.flash(0x8a2018);
    const g = this.add.image(o.c.x, o.c.y, 'soft').setScale(1.6).setTint(0xd94a3a)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(4);
    this.tweens.add({ targets: g, scale: 2.2, alpha: 0, duration: 900, repeat: 2, onComplete: () => g.destroy() });
    this.floatText(o.c.x, o.c.y - 64, 'BRACE!', '#E07A6A', 30);
  }

  boardDash(from, to) {
    return new Promise(res => {
      const fo = this.find(from), to_ = this.find(to);
      if (!fo || !to_) { res(); return; }
      play('board');
      const ox = fo.c.x;
      this.tweens.add({
        targets: fo.c, x: to_.c.x - (to_.c.x > ox ? 90 : -90), duration: 380, ease: 'Cubic.out',
        yoyo: true, hold: 250, onYoyo: () => res(), onComplete: () => { fo.c.x = ox; }
      });
    });
  }

  spawnReinforcement(nd, deadData) {
    return new Promise(res => {
      const W = this.scale.width, H = this.scale.height, s = this.shipScale();
      let x = W * 0.83, y = H * 0.5;
      const dO = deadData ? this.find(deadData) : null;
      if (dO) {
        x = dO.c.x; y = dO.c.y - 20;
        this.tweens.add({
          targets: dO.c, alpha: 0, duration: 400, onComplete: () => {
            if (dO._flames) dO._flames.destroy();
            dO.c.destroy();
            this.ships = this.ships.filter(o => o !== dO);
          }
        });
      }
      this.time.delayedCall(420, () => {
        const o = this.addShip(nd, 'boss', x, y, false, s);
        const tx = o.c.x;
        o.c.x = W + 140;
        o.c.alpha = 0;
        this.flash(0x2a4a52);
        this.tweens.add({ targets: o.c, x: tx, alpha: 1, duration: 620, ease: 'Cubic.out', onComplete: () => res() });
      });
    });
  }

  retreatAnim() {
    BT.b.fleet.forEach((s, i) => {
      const o = this.find(s);
      if (!o) return;
      this.tweens.add({ targets: o.c, x: -180, delay: i * 90, duration: 700, ease: 'Cubic.in' });
    });
  }
}
