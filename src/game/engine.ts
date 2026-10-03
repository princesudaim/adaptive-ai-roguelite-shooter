import { DIRECTOR_LINES, mulberry32 } from "./ai";
import { ENEMIES, WEAPONS } from "./data";
import { sfx } from "./audio";
import { createTelemetry } from "./ai";
import type { ThemeDef } from "./data";
import type {
  AiComment,
  EnemyDef,
  EnemyKind,
  HudState,
  MetaState,
  RunConfig,
  RunResult,
  RunTelemetry,
  WeaponId,
} from "./types";

export const WORLD_W = 1280;
export const WORLD_H = 720;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  glow: boolean;
}

interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  dmg: number;
  t: number;
  state: number;
  stateT: number;
  fireCd: number;
  flash: number;
  angle: number;
  seed: number;
  slow: number;
  elite: boolean;
  spawnT: number;
  dead: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  color: string;
  pierce: number;
  hit: number[];
  homing: number;
  aoe: number;
  bounces: number;
}

interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  color: string;
  bounces: number;
  spin: number;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  life: number;
  t: number;
}

interface Zone {
  x: number;
  y: number;
  r: number;
  kind: "null" | "well";
  t: number;
}

export interface EngineCallbacks {
  onHud: (h: HudState) => void;
  onEnd: (r: RunResult) => void;
  onComment: (c: Omit<AiComment, "id">) => void;
  onPause: () => void;
}

export interface EngineOpts {
  canvas: HTMLCanvasElement;
  config: RunConfig;
  meta: MetaState;
  theme: ThemeDef;
  weapon: WeaponId;
  callbacks: EngineCallbacks;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: RunConfig;
  private meta: MetaState;
  private theme: ThemeDef;
  private weaponId: WeaponId;
  private cb: EngineCallbacks;
  private rng: () => number;

  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private ended = false;
  private time = 0;

  // view
  private scale = 1;
  private ox = 0;
  private oy = 0;

  // player
  private px = WORLD_W / 2;
  private py = WORLD_H / 2;
  private pvx = 0;
  private pvy = 0;
  private pr = 13;
  private hp = 100;
  private maxHp = 100;
  private shield = 0;
  private iframe = 0;
  private dashCharges = 1;
  private maxDash = 1;
  private dashCd = 0;
  private dashT = 0;
  private dashDx = 0;
  private dashDy = 1;
  private fireCd = 0;
  private aim = 0;
  private overdrive = 0;
  private aimSource: "auto" | "mouse" | "stick" = "auto";
  private hurtFlash = 0;
  private whiteFlash = 0;
  private deathT = 0;
  private alive = true;

  // progress
  private score = 0;
  private combo = 0;
  private comboT = 0;
  private peakCombo = 0;
  private sector = 1;
  private sectorKills = 0;
  private sectorQuota = 10;
  private breather = 1.2;
  private eliteSpawned = false;
  private eliteAlive = false;
  private banner = "";
  private bannerSub = "";
  private bannerT = 0;

  // director
  private pressure = 0.35;
  private spawnTimer = 0;
  private spawnInterval = 1.6;
  private cap = 12;
  private lastDamageT = -99;
  private noDamageStreak = 0;
  private lowHpWarned = false;
  private commentT = 0;

  // entities
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private ebullets: EBullet[] = [];
  private pickups: Pickup[] = [];
  private zones: Zone[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private nextId = 1;

  // input
  private keys = new Set<string>();
  private moveX = 0;
  private moveY = 0;
  private stickAim: { x: number; y: number } | null = null;
  private firing = false;
  private mouseWorld = { x: WORLD_W / 2, y: WORLD_H / 2 };
  private isTouch = false;

  // arena bounds (shrink hazard)
  private bx0 = 40;
  private by0 = 40;
  private bx1 = WORLD_W - 40;
  private by1 = WORLD_H - 40;
  private shrinkTarget = 0;

  private shake = 0;
  private freeze = 0;
  private hudT = 0;
  private tel: RunTelemetry;
  private dmgTakenTotal = 0;
  private kills = 0;
  private killedBy = "DIRECT OVERRIDE";
  private telemetryTimer = 0;
  private dodgeCd = 0;

  constructor(opts: EngineOpts) {
    this.canvas = opts.canvas;
    this.ctx = opts.canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    this.cfg = opts.config;
    this.meta = opts.meta;
    this.theme = opts.theme;
    this.weaponId = opts.weapon;
    this.cb = opts.callbacks;
    this.rng = mulberry32(opts.config.seed || 1);
    this.tel = createTelemetry(opts.weapon);
    this.isTouch = matchMedia("(hover: none)").matches;

    const vit = this.meta.upgrades.vitality ?? 0;
    const oc = this.meta.upgrades.overclock ?? 0;
    this.maxHp = Math.round(100 * (1 + 0.14 * vit));
    this.hp = this.maxHp;
    this.maxDash = 1 + (this.meta.upgrades.reflex ?? 0);
    this.dashCharges = this.maxDash;
    this.shield = this.meta.upgrades.barrier ? 1 : 0;
    this.playerSpeedBase = 300 * (1 + 0.1 * oc);
    this.scoreMult = 1 + 0.08 * oc;
    this.sectorQuota = this.cfg.quotas[0] ?? 12;
    this.cap = 8 + this.cfg.threat + this.sector * 2;
    this.spawnInterval = 1.9 / this.cfg.spawnRateMult;

    this.bindEvents();
    this.resize();
    this.placeZones();
    this.spawnTimer = 0.35;
    this.breather = 0.7;
    this.commentT = 18;
  }

  private playerSpeedBase = 300;
  private scoreMult = 1;
  private weaponCdMult = 1;

  // ---------------------------------------------------------------- lifecycle
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.banner = "SECTOR 01";
    this.bannerSub = "AI DIRECTOR ONLINE — THREAT " + this.cfg.threat;
    this.bannerT = 2.4;
    this.cb.onComment({ text: DIRECTOR_LINES.calibrate[0], tone: "calibrate" });
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.last = performance.now();
  }

  // ---------------------------------------------------------------- events
  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "escape" || k === "p") {
      this.cb.onPause();
      return;
    }
    this.keys.add(k);
    if (k === " " || k === "shift") this.tryDash();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouseWorld = this.toWorld(e.clientX - r.left, e.clientY - r.top);
    this.aimSource = "mouse";
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) this.tryDash();
    else this.firing = true;
  };
  private onMouseUp = () => {
    this.firing = false;
  };
  private onCtx = (e: Event) => e.preventDefault();
  private onBlur = () => this.keys.clear();

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", this.onCtx);
  }
  private unbindEvents() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
  }

  // ---------------------------------------------------------------- public input (touch)
  setMoveAxis(x: number, y: number) {
    this.moveX = x;
    this.moveY = y;
  }
  setAimAxis(x: number, y: number) {
    if (x === 0 && y === 0) {
      this.stickAim = null;
      return;
    }
    this.stickAim = { x, y };
    this.aimSource = "stick";
  }
  setFiring(f: boolean) {
    this.firing = f;
  }
  triggerDash() {
    this.tryDash();
  }
  touchActive() {
    return this.isTouch;
  }

  // ---------------------------------------------------------------- helpers
  private toWorld(cx: number, cy: number) {
    return { x: (cx - this.ox) / this.scale, y: (cy - this.oy) / this.scale };
  }

  private ww = WORLD_W;
  private wh = WORLD_H;

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    // world adapts to viewport aspect so there is never heavy letterboxing
    const aspect = w / h;
    if (aspect >= 1) {
      this.wh = 720;
      this.ww = clamp(720 * aspect, 900, 1800);
    } else {
      this.ww = 760;
      this.wh = clamp(760 / aspect, 900, 1800);
    }
    this.scale = Math.min(w / this.ww, h / this.wh);
    this.ox = (w - this.ww * this.scale) / 2;
    this.oy = (h - this.wh * this.scale) / 2;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.cfg.hazard !== "shrink") {
      this.bx1 = this.ww - 40;
      this.by1 = this.wh - 40;
    }
    // keep the player inside if the arena shrank
    this.px = clamp(this.px, this.bx0 + 20, this.bx1 - 20);
    this.py = clamp(this.py, this.by0 + 20, this.by1 - 20);
  }

  private addShake(v: number) {
    if (this.meta.screenShake) this.shake = Math.min(26, this.shake + v);
  }

  private particle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    drag = 3,
    glow = true,
  ) {
    if (this.particles.length > 620) this.particles.shift();
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, drag, glow });
  }

  private burst(x: number, y: number, n: number, color: string, spd = 200, size = 3, life = 0.45) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU;
      const s = spd * (0.35 + this.rng() * 0.9);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + this.rng() * 0.8), size * (0.6 + this.rng() * 0.8), color, 4);
    }
  }

  private floater(x: number, y: number, text: string, color: string, size = 14) {
    if (this.floaters.length > 44) this.floaters.shift();
    this.floaters.push({ x, y, vy: -46, life: 0.85, text, color, size });
  }

  private comment(text: string, tone: AiComment["tone"]) {
    this.cb.onComment({ text, tone });
    sfx.ai();
  }

  // ---------------------------------------------------------------- main loop
  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 1 / 20) dt = 1 / 20;
    if (this.paused) {
      this.render(0);
      return;
    }
    const sdt = dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      dt *= 0.18;
    }
    if (!this.alive) {
      this.deathT += sdt;
      dt *= 0.35;
      if (this.deathT > 1.5 && !this.ended) this.finish(false);
    } else {
      this.update(dt);
    }
    this.updateParticles(dt);
    this.render(dt);
    this.hudT += sdt;
    if (this.hudT > 0.07) {
      this.hudT = 0;
      this.emitHud();
    }
  };

  // ---------------------------------------------------------------- update
  private update(dt: number) {
    this.time += dt;
    this.tel.timeAlive += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.commentT > 0) this.commentT -= dt;
    else if (this.time > 12) {
      this.commentT = 16 + this.rng() * 10;
      const hpFrac = this.hp / this.maxHp;
      const pool =
        this.pressure > 1
          ? DIRECTOR_LINES.pressure
          : hpFrac > 0.85
            ? DIRECTOR_LINES.pressure
            : DIRECTOR_LINES.adapt;
      this.comment(
        pool[Math.floor(this.rng() * pool.length)],
        this.pressure > 1 ? "pressure" : "adapt",
      );
    }
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    if (this.whiteFlash > 0) this.whiteFlash = Math.max(0, this.whiteFlash - dt * 3.4);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);
    if (this.iframe > 0) this.iframe -= dt;
    if (this.overdrive > 0) this.overdrive -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    this.weaponCdMult = (1 - 0.12 * (this.meta.upgrades.coolant ?? 0)) * (this.overdrive > 0 ? 0.55 : 1);

    this.updatePlayer(dt);
    this.updateZones(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEBullets(dt);
    this.updatePickups(dt);
    this.director(dt);
    this.sampleTelemetry(dt);
  }

  private playerSlow = 1;

  private updatePlayer(dt: number) {
    let mx = this.moveX;
    let my = this.moveY;
    if (!this.isTouch || this.moveX !== 0 || this.moveY !== 0) {
      const k = this.keys;
      let kx = 0;
      let ky = 0;
      if (k.has("a") || k.has("arrowleft")) kx -= 1;
      if (k.has("d") || k.has("arrowright")) kx += 1;
      if (k.has("w") || k.has("arrowup")) ky -= 1;
      if (k.has("s") || k.has("arrowdown")) ky += 1;
      if (kx || ky) {
        const m = Math.hypot(kx, ky);
        mx = kx / m;
        my = ky / m;
      }
    }
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    // aim
    if (this.aimSource === "stick" && this.stickAim) {
      this.aim = Math.atan2(this.stickAim.y, this.stickAim.x);
    } else if (this.aimSource === "mouse") {
      this.aim = Math.atan2(this.mouseWorld.y - this.py, this.mouseWorld.x - this.px);
    } else {
      const e = this.nearestEnemy();
      if (e) this.aim = Math.atan2(e.y - this.py, e.x - this.px);
      else if (mag > 0.1) this.aim = Math.atan2(my, mx);
    }

    // dash
    if (this.dashT > 0) {
      this.dashT -= dt;
      const ds = 900;
      this.pvx = this.dashDx * ds;
      this.pvy = this.dashDy * ds;
      this.iframe = Math.max(this.iframe, 0.06);
      if (this.rng() < 0.9)
        this.particle(
          this.px - this.dashDx * 12,
          this.py - this.dashDy * 12,
          -this.dashDx * 60 + (this.rng() - 0.5) * 40,
          -this.dashDy * 60 + (this.rng() - 0.5) * 40,
          0.3,
          7,
          this.theme.pal.player,
          2,
        );
    } else {
      const target = this.playerSpeedBase * this.playerSlow;
      const ax = 14;
      this.pvx = lerp(this.pvx, mx * target, clamp(ax * dt, 0, 1));
      this.pvy = lerp(this.pvy, my * target, clamp(ax * dt, 0, 1));
      if (mag > 0.1) {
        this.tel.distTravelled += Math.hypot(this.pvx, this.pvy) * dt;
        this.tel.timeInMotion += dt;
      }
    }
    this.playerSlow = 1;

    this.px += this.pvx * dt;
    this.py += this.pvy * dt;

    // bounds
    const pad = this.pr;
    if (this.px < this.bx0 + pad) {
      this.px = this.bx0 + pad;
      this.pvx *= -0.2;
    }
    if (this.px > this.bx1 - pad) {
      this.px = this.bx1 - pad;
      this.pvx *= -0.2;
    }
    if (this.py < this.by0 + pad) {
      this.py = this.by0 + pad;
      this.pvy *= -0.2;
    }
    if (this.py > this.by1 - pad) {
      this.py = this.by1 - pad;
      this.pvy *= -0.2;
    }

    // telemetry: wall hugging
    const wallDist = Math.min(this.px - this.bx0, this.bx1 - this.px, this.py - this.by0, this.by1 - this.py);
    if (wallDist < 95) this.tel.timeNearWall += dt;

    // dash recharge
    if (this.dashCharges < this.maxDash) {
      this.dashCd -= dt;
      if (this.dashCd <= 0) {
        this.dashCharges++;
        this.dashCd = 1.45;
      }
    }

    // fire
    this.fireCd -= dt;
    const wantFire = this.meta.autofire ? true : this.firing;
    if (wantFire && this.fireCd <= 0) this.shoot();

    // low hp telemetry + warning
    const frac = this.hp / this.maxHp;
    if (frac < 0.25) {
      this.tel.timeLowHp += dt;
      if (!this.lowHpWarned) {
        this.lowHpWarned = true;
        this.comment("INTEGRITY CRITICAL. I can taste the ending.", "pressure");
      }
    }
  }

  private tryDash() {
    if (!this.alive || this.dashT > 0 || this.dashCharges <= 0) return;
    let dx = 0;
    let dy = 0;
    if (this.isTouch) {
      const m = Math.hypot(this.moveX, this.moveY);
      if (m > 0.2) {
        dx = this.moveX / m;
        dy = this.moveY / m;
      } else {
        dx = Math.cos(this.aim);
        dy = Math.sin(this.aim);
      }
    } else {
      const k = this.keys;
      let kx = 0;
      let ky = 0;
      if (k.has("a") || k.has("arrowleft")) kx -= 1;
      if (k.has("d") || k.has("arrowright")) kx += 1;
      if (k.has("w") || k.has("arrowup")) ky -= 1;
      if (k.has("s") || k.has("arrowdown")) ky += 1;
      if (kx || ky) {
        const m = Math.hypot(kx, ky);
        dx = kx / m;
        dy = ky / m;
      } else {
        dx = Math.cos(this.aim);
        dy = Math.sin(this.aim);
      }
    }
    this.dashDx = dx;
    this.dashDy = dy;
    this.dashT = 0.17;
    if (this.dashCharges === this.maxDash) this.dashCd = 1.45;
    this.dashCharges--;
    this.tel.dashesUsed++;
    this.iframe = 0.26;
    sfx.dash();
    this.addShake(4);
    this.burst(this.px, this.py, 12, this.theme.pal.player, 260, 4, 0.3);
  }

  private shoot() {
    const w = WEAPONS[this.weaponId];
    this.fireCd = w.cd * this.weaponCdMult;
    this.tel.shotsFired += w.count;
    const spread = w.spread;
    for (let i = 0; i < w.count; i++) {
      const a = this.aim + (this.rng() - 0.5) * spread * 2 + (w.count > 1 ? (i / (w.count - 1) - 0.5) * spread * 1.6 : 0);
      const spd = w.speed * (this.overdrive > 0 ? 1.15 : 1);
      this.bullets.push({
        x: this.px + Math.cos(a) * 16,
        y: this.py + Math.sin(a) * 16,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: w.size * (this.overdrive > 0 ? 1.35 : 1),
        dmg: w.dmg,
        life: w.life,
        color: w.color,
        pierce: w.pierce,
        hit: [],
        homing: this.weaponId === "arc" ? 2.4 : 0,
        aoe: this.weaponId === "nova" ? 62 : 0,
        bounces: 0,
      });
    }
    this.pvx -= Math.cos(this.aim) * w.kick;
    this.pvy -= Math.sin(this.aim) * w.kick;
    this.particle(
      this.px + Math.cos(this.aim) * 20,
      this.py + Math.sin(this.aim) * 20,
      Math.cos(this.aim) * 120,
      Math.sin(this.aim) * 120,
      0.14,
      6,
      w.color,
      6,
    );
    sfx.shoot(this.weaponId);
    if (this.weaponId === "rail" || this.weaponId === "scatter") this.addShake(3);
  }

  // ---------------------------------------------------------------- spawning
  private spawnEdge(): { x: number; y: number; edge: string } {
    const bias = this.cfg.spawnSideBias;
    let r = this.rng();
    if (bias) r = r * 0.45 + (bias === "left" ? 0 : bias === "right" ? 0.5 : 0.25);
    const m = 60;
    if (r < 0.25) return { x: this.bx0 - m, y: lerp(this.by0, this.by1, this.rng()), edge: "left" };
    if (r < 0.5) return { x: this.bx1 + m, y: lerp(this.by0, this.by1, this.rng()), edge: "right" };
    if (r < 0.75) return { x: lerp(this.bx0, this.bx1, this.rng()), y: this.by0 - m, edge: "top" };
    return { x: lerp(this.bx0, this.bx1, this.rng()), y: this.by1 + m, edge: "bottom" };
  }

  private pickKind(): EnemyKind {
    const entries = Object.entries(this.cfg.enemyWeights) as [EnemyKind, number][];
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.rng() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return k;
    }
    return "chaser";
  }

  private spawnEnemy(kind: EnemyKind, x?: number, y?: number, elite = false) {
    const def = ENEMIES[kind];
    let p = x === undefined || y === undefined ? this.spawnEdge() : { x, y, edge: "" };
    if (kind === "turret" && x === undefined) {
      // stationary bastions deploy inside the arena, away from the player
      for (let i = 0; i < 12; i++) {
        const cx = lerp(this.bx0 + 140, this.bx1 - 140, this.rng());
        const cy = lerp(this.by0 + 120, this.by1 - 120, this.rng());
        if (Math.hypot(cx - this.px, cy - this.py) > 260) {
          p = { x: cx, y: cy, edge: "" };
          break;
        }
      }
    }
    const hp = def.hp * this.cfg.hpMult * (elite ? 3.5 + this.cfg.threat * 0.55 : 1) * (1 + (this.sector - 1) * 0.06);
    const e: Enemy = {
      id: this.nextId++,
      kind,
      def,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      r: def.r * (elite ? 2.1 : 1),
      speed: def.speed * this.cfg.speedMult * (elite ? 0.3 : 1),
      dmg: def.dmg * (elite ? 1.35 : 1) * (1 + (this.cfg.threat - 1) * 0.03),
      t: 0,
      state: 0,
      stateT: 0,
      fireCd: (def.fireCd ?? 2) * this.cfg.fireRateMult * (0.6 + this.rng() * 0.7),
      flash: 0,
      angle: 0,
      seed: this.rng() * 1000,
      slow: 0,
      elite,
      spawnT: 0.45,
      dead: false,
    };
    this.enemies.push(e);
    if (elite) {
      this.eliteAlive = true;
      this.banner = "OVERSEER ONLINE";
      this.bannerSub = "DESTROY IT TO END THE RUN";
      this.bannerT = 3;
      this.addShake(14);
      this.comment("Fine. I will handle you personally.", "pressure");
    }
  }

  private spawnPack() {
    const kind = this.pickKind();
    const t = this.cfg.threat;
    if (kind === "swarm") {
      const n = 4 + Math.floor(t * 0.9);
      const p = this.spawnEdge();
      for (let i = 0; i < n; i++)
        this.spawnEnemy("swarm", p.x + (this.rng() - 0.5) * 70, p.y + (this.rng() - 0.5) * 70);
    } else if (kind === "shooter" && this.rng() < 0.5) {
      const p = this.spawnEdge();
      this.spawnEnemy("shooter", p.x, p.y);
      if (t >= 3) this.spawnEnemy("shooter", p.x + (this.rng() - 0.5) * 90, p.y + (this.rng() - 0.5) * 90);
    } else if (kind === "chaser") {
      const n = t >= 4 ? 2 : 1;
      const p = this.spawnEdge();
      for (let i = 0; i < n; i++) this.spawnEnemy("chaser", p.x + (this.rng() - 0.5) * 60, p.y + (this.rng() - 0.5) * 60);
    } else if (this.cfg.flankers && (kind === "assassin" || kind === "charger") && this.rng() < 0.6) {
      // flanker: spawn on the opposite side of the player's facing
      const a = this.aim + Math.PI + (this.rng() - 0.5) * 1.2;
      const dist = 420;
      this.spawnEnemy(kind, clamp(this.px + Math.cos(a) * dist, this.bx0, this.bx1), clamp(this.py + Math.sin(a) * dist, this.by0, this.by1));
    } else {
      this.spawnEnemy(kind);
    }
  }

  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.x - this.px) ** 2 + (e.y - this.py) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- director
  private director(dt: number) {
    if (this.breather > 0) {
      this.breather -= dt;
      if (this.breather <= 0 && this.sector > 1) {
        this.banner = `SECTOR ${String(this.sector).padStart(2, "0")}`;
        this.bannerSub = `THREAT ${this.cfg.threat} · ${this.cfg.hazard !== "none" ? "ENVIRONMENT MODIFIED" : "STANDARD ENVIRONMENT"}`;
        this.bannerT = 2.2;
      }
      return;
    }
    if (this.eliteAlive) return;

    // pressure model
    const hpFrac = this.hp / this.maxHp;
    const density = clamp(this.enemies.length / this.cap, 0, 1.6);
    const recentDamage = clamp(1 - (this.time - this.lastDamageT) / 5, 0, 1);
    const target = this.cfg.flowTarget;
    this.pressure = clamp(density * 0.62 + (1 - hpFrac) * 0.3 + recentDamage * 0.25, 0, 1.4);

    this.spawnTimer -= dt * (this.pressure < target * 0.72 ? 1.45 : this.pressure > 1.15 ? 0.55 : 1);
    if (this.spawnTimer <= 0 && this.enemies.length < this.cap) {
      this.spawnTimer = this.spawnInterval * (0.7 + this.rng() * 0.6);
      this.spawnPack();
    }

    // sector progression
    if (this.sectorKills >= this.sectorQuota) {
      this.sector++;
      this.tel.sector = this.sector;
      if (this.sector > this.cfg.sectors) {
        this.finish(true);
        return;
      }
      this.sectorKills = 0;
      this.sectorQuota = this.cfg.quotas[this.sector - 1] ?? this.sectorQuota;
      this.breather = 2.6;
      const bonus = 500 * this.sector * (1 + this.cfg.threat * 0.1);
      this.score += Math.round(bonus * this.scoreMult);
      this.banner = "SECTOR CLEARED";
      this.bannerSub = `+${Math.round(bonus)} · THREAT ${this.cfg.threat}`;
      this.bannerT = 2.4;
      const heal = 12 * (this.meta.upgrades.autodoct ?? 0);
      if (heal) {
        this.hp = Math.min(this.maxHp, this.hp + heal);
        this.floater(this.px, this.py - 30, `+${heal}`, "#4ade80", 16);
      }
      this.placeZones();
      this.cap = 8 + this.cfg.threat + this.sector * 2;
      this.spawnInterval *= 0.93;
      sfx.sector();
      this.addShake(8);
      this.whiteFlash = 0.4;
      if (this.sector === this.cfg.sectors) {
        this.eliteSpawned = true;
        this.breather = 2.2;
      } else {
        const lines = DIRECTOR_LINES.adapt;
        this.comment(lines[Math.floor(this.rng() * lines.length)], "adapt");
      }
    }

    if (this.sector === this.cfg.sectors && this.eliteSpawned && !this.eliteAlive && this.enemies.length < 4) {
      this.spawnEnemy("turret", lerp(this.bx0, this.bx1, 0.5), lerp(this.by0, this.by1, 0.42), true);
    }

    // steamroll detection
    if (this.time - this.lastDamageT > 12 && this.noDamageStreak === 0 && this.time > 15) {
      this.noDamageStreak = 1;
      this.comment("You are outperforming my model. Correcting.", "pressure");
      for (let i = 0; i < 2; i++) this.spawnPack();
    }
    if (this.time - this.lastDamageT < 3) this.noDamageStreak = 0;
  }

  private placeZones() {
    this.zones = [];
    if (this.cfg.hazard === "nullzones") {
      const n = 2 + Math.floor(this.sector / 2);
      for (let i = 0; i < n; i++)
        this.zones.push({
          x: lerp(this.bx0 + 160, this.bx1 - 160, this.rng()),
          y: lerp(this.by0 + 140, this.by1 - 140, this.rng()),
          r: 110 + this.rng() * 60,
          kind: "null",
          t: 0,
        });
    } else if (this.cfg.hazard === "gravitywells") {
      const n = 2;
      for (let i = 0; i < n; i++)
        this.zones.push({
          x: lerp(this.bx0 + 200, this.bx1 - 200, this.rng()),
          y: lerp(this.by0 + 180, this.by1 - 180, this.rng()),
          r: 260,
          kind: "well",
          t: 0,
        });
    }
    if (this.cfg.hazard === "shrink") {
      this.bx0 = 40;
      this.by0 = 40;
      this.bx1 = this.ww - 40;
      this.by1 = this.wh - 40;
      this.shrinkTarget = 0;
    }
  }

  private updateZones(dt: number) {
    for (const z of this.zones) {
      z.t += dt;
      const dx = z.x - this.px;
      const dy = z.y - this.py;
      const d = Math.hypot(dx, dy) || 1;
      if (z.kind === "null" && d < z.r) this.playerSlow = Math.min(this.playerSlow, 0.45);
      if (z.kind === "well") {
        const f = clamp(1 - d / z.r, 0, 1) * 460;
        this.pvx += (dx / d) * f * dt;
        this.pvy += (dy / d) * f * dt;
      }
    }
    if (this.cfg.hazard === "shrink" && this.breather <= 0) {
      this.shrinkTarget += dt;
      const amt = Math.min(this.shrinkTarget * 6.5, 150);
      this.bx0 = 40 + amt;
      this.by0 = 40 + amt * 0.6;
      this.bx1 = this.ww - 40 - amt;
      this.by1 = this.wh - 40 - amt * 0.6;
      const wallDist = Math.min(this.px - this.bx0, this.bx1 - this.px, this.py - this.by0, this.by1 - this.py);
      if (wallDist < 2) this.damagePlayer(9 * dt * 6, "COLLAPSE FIELD", this.px, this.py, true);
    }
  }

  // ---------------------------------------------------------------- enemies
  private updateEnemies(dt: number) {
    const W = this;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt * 5;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        if (e.kind !== "turret") {
          const tx = W.px - e.x;
          const ty = W.py - e.y;
          const m = Math.hypot(tx, ty) || 1;
          e.x += (tx / m) * e.speed * 0.5 * dt;
          e.y += (ty / m) * e.speed * 0.5 * dt;
        }
        continue;
      }
      const dx = W.px - e.x;
      const dy = W.py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      e.angle = Math.atan2(dy, dx);

      switch (e.kind) {
        case "chaser": {
          const wob = Math.sin(e.t * 3 + e.seed) * 0.35;
          const ax = Math.cos(e.angle + wob);
          const ay = Math.sin(e.angle + wob);
          e.vx = lerp(e.vx, ax * e.speed, 4 * dt);
          e.vy = lerp(e.vy, ay * e.speed, 4 * dt);
          break;
        }
        case "swarm": {
          const wob = Math.sin(e.t * 9 + e.seed) * 1.1;
          e.vx = Math.cos(e.angle + wob) * e.speed;
          e.vy = Math.sin(e.angle + wob) * e.speed;
          break;
        }
        case "shooter": {
          const want = 330;
          const push = dist < want ? -1 : 1;
          const strafe = Math.sin(e.t * 1.1 + e.seed) * 0.9;
          e.vx = lerp(e.vx, (ux * push + Math.cos(e.angle + Math.PI / 2) * strafe) * e.speed, 3 * dt);
          e.vy = lerp(e.vy, (uy * push + Math.sin(e.angle + Math.PI / 2) * strafe) * e.speed, 3 * dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && dist < 620) {
            e.fireCd = (ENEMIES.shooter.fireCd ?? 1.5) * W.cfg.fireRateMult;
            e.stateT = 0.25;
            W.fireEnemyBullet(e, e.angle, 260 * W.cfg.bulletSpeedMult, e.dmg * 0.8);
            if (W.cfg.threat >= 4 && W.rng() < 0.4)
              W.fireEnemyBullet(e, e.angle + 0.22, 260 * W.cfg.bulletSpeedMult, e.dmg * 0.8);
          }
          break;
        }
        case "orbiter": {
          const want = 240;
          const tangential = e.seed % 2 < 1 ? 1 : -1;
          const radial = (dist - want) * 0.02;
          e.vx = lerp(e.vx, (Math.cos(e.angle + (Math.PI / 2) * tangential) * 1 + ux * radial) * e.speed, 3 * dt);
          e.vy = lerp(e.vy, (Math.sin(e.angle + (Math.PI / 2) * tangential) * 1 + uy * radial) * e.speed, 3 * dt);
          e.fireCd -= dt;
          if (e.fireCd <= 0) {
            e.fireCd = (ENEMIES.orbiter.fireCd ?? 2) * W.cfg.fireRateMult;
            for (let i = -1; i <= 1; i++)
              W.fireEnemyBullet(e, e.angle + i * 0.16, 300 * W.cfg.bulletSpeedMult, e.dmg * 0.7);
          }
          break;
        }
        case "charger": {
          if (e.state === 0) {
            e.vx = lerp(e.vx, -ux * e.speed * 0.35, 3 * dt);
            e.vy = lerp(e.vy, -uy * e.speed * 0.35, 3 * dt);
            if (e.stateT > 0.9 && dist < 460) {
              e.state = 1;
              e.stateT = 0;
            }
            e.stateT += dt;
          } else if (e.state === 1) {
            e.vx *= 0.9;
            e.vy *= 0.9;
            e.stateT += dt;
            if (e.stateT > 0.55) {
              e.state = 2;
              e.stateT = 0;
              e.vx = ux * e.speed * 5.4;
              e.vy = uy * e.speed * 5.4;
              W.burst(e.x, e.y, 10, e.def.color, 220, 3, 0.3);
            }
          } else if (e.state === 2) {
            e.stateT += dt;
            W.particle(e.x, e.y, (W.rng() - 0.5) * 40, (W.rng() - 0.5) * 40, 0.25, 5, e.def.color, 3);
            if (e.stateT > 0.42) {
              e.state = 3;
              e.stateT = 0;
            }
          } else {
            e.vx *= 0.86;
            e.vy *= 0.86;
            e.stateT += dt;
            if (e.stateT > 0.7) {
              e.state = 0;
              e.stateT = 0;
            }
          }
          break;
        }
        case "splitter": {
          e.vx = lerp(e.vx, ux * e.speed, 2.4 * dt);
          e.vy = lerp(e.vy, uy * e.speed, 2.4 * dt);
          break;
        }
        case "turret": {
          e.vx = 0;
          e.vy = 0;
          e.fireCd -= dt;
          if (e.fireCd <= 0) {
            e.fireCd = (ENEMIES.turret.fireCd ?? 2.4) * W.cfg.fireRateMult;
            const n = e.elite ? 14 : 8;
            const off = e.elite ? e.t * 1.3 : 0;
            for (let i = 0; i < n; i++)
              W.fireEnemyBullet(e, off + (i / n) * TAU, (e.elite ? 240 : 200) * W.cfg.bulletSpeedMult, e.dmg * 0.6);
          }
          break;
        }
        case "assassin": {
          if (e.state === 0) {
            // approach at an offset angle to flank
            const off = e.seed % 2 < 1 ? 0.9 : -0.9;
            e.vx = lerp(e.vx, Math.cos(e.angle + off) * e.speed, 3 * dt);
            e.vy = lerp(e.vy, Math.sin(e.angle + off) * e.speed, 3 * dt);
            e.stateT += dt;
            if (e.stateT > 1.6) {
              e.state = 1;
              e.stateT = 0;
              W.burst(e.x, e.y, 16, "#ffffff", 200, 3, 0.35);
            }
          } else if (e.state === 1) {
            e.vx *= 0.8;
            e.vy *= 0.8;
            e.stateT += dt;
            if (e.stateT > 0.3) {
              // blink to player's blind side
              const a = W.aim + Math.PI + (W.rng() - 0.5) * 1.5;
              e.x = clamp(W.px + Math.cos(a) * 190, W.bx0 + 20, W.bx1 - 20);
              e.y = clamp(W.py + Math.sin(a) * 190, W.by0 + 20, W.by1 - 20);
              e.state = 2;
              e.stateT = 0;
              W.burst(e.x, e.y, 22, "#ffffff", 260, 3, 0.4);
              W.addShake(3);
            }
          } else if (e.state === 2) {
            e.stateT += dt;
            e.vx = lerp(e.vx, ux * e.speed * 2.1, 8 * dt);
            e.vy = lerp(e.vy, uy * e.speed * 2.1, 8 * dt);
            if (e.stateT > 0.5) {
              e.state = 0;
              e.stateT = 0;
            }
          }
          break;
        }
      }

      // gravity wells affect enemies too
      for (const z of this.zones) {
        if (z.kind !== "well") continue;
        const zdx = z.x - e.x;
        const zdy = z.y - e.y;
        const zd = Math.hypot(zdx, zdy) || 1;
        const f = clamp(1 - zd / z.r, 0, 1) * 120;
        e.vx += (zdx / zd) * f * dt;
        e.vy += (zdy / zd) * f * dt;
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // clamp inside arena once entered
      const m = e.r + 4;
      if (e.x < W.bx0 - 70 && e.vx < 0) e.vx *= -1;
      if (e.x > W.bx1 + 70 && e.vx > 0) e.vx *= -1;
      if (e.y < W.by0 - 70 && e.vy < 0) e.vy *= -1;
      if (e.y > W.by1 + 70 && e.vy > 0) e.vy *= -1;
      if (e.t > 1.2) {
        e.x = clamp(e.x, W.bx0 - m, W.bx1 + m);
        e.y = clamp(e.y, W.by0 - m, W.by1 + m);
      }

      // contact damage
      if (dist < e.r + W.pr) {
        W.damagePlayer(e.dmg, e.def.name, e.x, e.y);
        if (e.kind === "swarm") W.killEnemy(e, false);
        if (e.kind === "charger" && e.state === 2) {
          e.state = 3;
          e.stateT = 0;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private fireEnemyBullet(e: Enemy, angle: number, speed: number, dmg: number) {
    this.ebullets.push({
      x: e.x + Math.cos(angle) * (e.r + 4),
      y: e.y + Math.sin(angle) * (e.r + 4),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: e.elite ? 8 : 6,
      dmg,
      life: 4.5,
      color: e.elite ? "#ff4d6d" : e.def.color,
      bounces: this.cfg.hazard === "mirrorshards" ? 2 : 0,
      spin: 0,
    });
  }

  // ---------------------------------------------------------------- bullets
  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.life -= dt;
      if (b.homing) {
        const e = this.nearestEnemy();
        if (e) {
          const a = Math.atan2(e.y - b.y, e.x - b.x);
          const sp = Math.hypot(b.vx, b.vy);
          const ca = Math.atan2(b.vy, b.vx);
          let da = a - ca;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = ca + clamp(da, -b.homing * dt, b.homing * dt);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }
      for (const z of this.zones) {
        if (z.kind !== "well") continue;
        const dx = z.x - b.x;
        const dy = z.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = clamp(1 - d / z.r, 0, 1) * 420;
        b.vx += (dx / d) * f * dt;
        b.vy += (dy / d) * f * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < this.bx0 || b.x > this.bx1 || b.y < this.by0 || b.y > this.by1) b.life = -1;

      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (b.hit.includes(e.id)) continue;
        const rr = e.r + b.r;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          const firstHit = b.hit.length === 0;
          this.hitEnemy(e, b.dmg, b);
          b.hit.push(e.id);
          if (firstHit) this.tel.shotsHit++;
          if (b.aoe) {
            for (const o of this.enemies) {
              if (o.dead || o === e) continue;
              if (Math.hypot(o.x - b.x, o.y - b.y) < b.aoe) this.hitEnemy(o, b.dmg * 0.6, b, false);
            }
            this.burst(b.x, b.y, 22, b.color, 320, 4, 0.45);
            this.addShake(5);
          }
          if (b.pierce > 0) {
            b.pierce--;
            b.dmg *= 0.85;
          } else {
            b.life = -1;
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private updateEBullets(dt: number) {
    for (const b of this.ebullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.bounces > 0) {
        if (b.x < this.bx0 || b.x > this.bx1) {
          b.vx *= -1;
          b.bounces--;
          b.x = clamp(b.x, this.bx0, this.bx1);
        }
        if (b.y < this.by0 || b.y > this.by1) {
          b.vy *= -1;
          b.bounces--;
          b.y = clamp(b.y, this.by0, this.by1);
        }
      }
      const d = Math.hypot(b.x - this.px, b.y - this.py);
      if (d < b.r + this.pr) {
        this.damagePlayer(b.dmg, "PROJECTILE", b.x, b.y);
        b.life = -1;
        continue;
      }
      // near miss telemetry
      if (d < 30 && b.life > 0.2) {
        this.tel.nearMisses++;
        this.tel.closestCall = Math.min(this.tel.closestCall, d - b.r - this.pr);
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0 && b.bounces >= 0);
  }

  private hitEnemy(e: Enemy, dmg: number, b?: Bullet, showNum = true) {
    e.hp -= dmg;
    e.flash = 1;
    this.tel.damageDealt += dmg;
    if (showNum) this.floater(e.x + (this.rng() - 0.5) * 12, e.y - e.r, String(Math.round(dmg)), b?.color ?? "#fff", 12);
    this.particle(
      e.x,
      e.y,
      (this.rng() - 0.5) * 120,
      (this.rng() - 0.5) * 120,
      0.22,
      3,
      e.def.color,
      5,
    );
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  private killEnemy(e: Enemy, scored: boolean) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboT = 2.6;
    if (this.combo > this.peakCombo) this.peakCombo = this.combo;
    this.tel.killsByType[e.def.name] = (this.tel.killsByType[e.def.name] ?? 0) + 1;
    if (this.hp / this.maxHp < 0.25) this.tel.killsAtLowHp++;
    if (scored) {
      const mult = 1 + Math.min(4, this.combo * 0.05);
      const pts = Math.round(e.def.score * mult * this.scoreMult * (e.elite ? 8 : 1));
      this.score += pts;
      this.floater(e.x, e.y - 10, `+${pts}`, this.theme.pal.accent, e.elite ? 26 : 13);
    }
    this.sectorKills++;
    this.burst(e.x, e.y, e.elite ? 90 : 14 + Math.floor(e.r), e.def.color, e.elite ? 520 : 260, e.elite ? 6 : 3.4, e.elite ? 1.1 : 0.5);
    this.particle(e.x, e.y, 0, 0, 0.5, e.r * 1.1, e.def.color, 1);
    if (this.combo > 0 && this.combo % 10 === 0) {
      this.floater(this.px, this.py - 46, `CHAIN x${this.combo}`, "#fbbf24", 20);
      sfx.combo(this.combo);
      this.addShake(6);
    }
    if (e.kind === "splitter" && !e.elite) {
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy("swarm", e.x + (this.rng() - 0.5) * 50, e.y + (this.rng() - 0.5) * 50);
        const s = this.enemies[this.enemies.length - 1];
        s.spawnT = 0.1;
      }
    }
    if (e.elite) {
      this.eliteAlive = false;
      this.addShake(26);
      this.freeze = 0.28;
      this.whiteFlash = 1;
      this.ebullets = [];
      sfx.bigKill();
      if (this.alive) this.finish(true);
    } else {
      sfx.kill();
      this.freeze = e.r > 19 ? 0.05 : 0.02;
      this.addShake(e.r > 19 ? 5 : 2.4);
    }
    this.maybeDrop(e);
  }

  private maybeDrop(e: Enemy) {
    if (e.kind === "swarm" && this.rng() > 0.12) return;
    const rate = this.cfg.pickupRate;
    if (this.rng() > 0.16 * rate) return;
    const frac = this.hp / this.maxHp;
    let type = "shard";
    const r = this.rng();
    if (frac < 0.55 && r < 0.42) type = "hp";
    else if (r < 0.58) type = "shield";
    else if (r < 0.76) type = "overdrive";
    else if (r < 0.86) type = "nuke";
    this.pickups.push({ x: e.x, y: e.y, vx: (this.rng() - 0.5) * 60, vy: (this.rng() - 0.5) * 60, type, life: 14, t: 0 });
    this.tel.pickupsSpawned++;
  }

  private updatePickups(dt: number) {
    const magnet = 46 * (1 + 0.7 * (this.meta.upgrades.magnet ?? 0));
    for (const p of this.pickups) {
      p.life -= dt;
      p.t += dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < magnet + 60) {
        const f = 320 / Math.max(40, d);
        p.vx += (dx / d) * f * 60 * dt;
        p.vy += (dy / d) * f * 60 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < this.pr + 16) {
        p.life = -1;
        this.tel.pickupsTaken++;
        sfx.pickup();
        this.burst(p.x, p.y, 10, "#ffffff", 180, 2.5, 0.3);
        switch (p.type) {
          case "hp":
            this.hp = Math.min(this.maxHp, this.hp + 22);
            this.floater(this.px, this.py - 34, "+22 INTEGRITY", "#4ade80");
            break;
          case "shield":
            this.shield = 1;
            this.floater(this.px, this.py - 34, "SHIELD UP", "#60a5fa");
            break;
          case "overdrive":
            this.overdrive = 6.5;
            this.floater(this.px, this.py - 34, "OVERDRIVE", "#fbbf24");
            this.whiteFlash = 0.25;
            break;
          case "nuke": {
            this.whiteFlash = 0.6;
            this.addShake(18);
            sfx.bigKill();
            for (const e of [...this.enemies]) {
              if (e.dead || e.spawnT > 0) continue;
              this.hitEnemy(e, 60 + this.cfg.threat * 6, undefined, false);
            }
            this.ebullets = [];
            this.floater(this.px, this.py - 34, "PURGE", "#ff4d6d", 22);
            break;
          }
          default:
            this.score += Math.round(120 * this.scoreMult);
            this.floater(this.px, this.py - 34, "+SALVAGE", "#c084fc");
        }
      }
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (this.particles.length) this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.94;
    }
    if (this.floaters.length) this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // ---------------------------------------------------------------- damage
  private damagePlayer(dmg: number, source: string, sx: number, sy: number, dot = false) {
    if (!this.alive) return;
    if (this.iframe > 0 || this.dashT > 0) return;
    const reduce = 1 - 0.12 * (this.meta.upgrades.plating ?? 0);
    let d = dmg * reduce;
    if (this.shield > 0) {
      this.shield = 0;
      this.iframe = 0.7;
      this.burst(this.px, this.py, 26, "#60a5fa", 320, 3.5, 0.5);
      this.floater(this.px, this.py - 40, "SHIELD BROKEN", "#60a5fa", 16);
      this.addShake(8);
      sfx.hurt();
      return;
    }
    this.hp -= d;
    this.dmgTakenTotal += d;
    this.tel.damageTaken += d;
    this.tel.damageBySource[source] = (this.tel.damageBySource[source] ?? 0) + d;
    const dx = sx - this.px;
    const dy = sy - this.py;
    if (Math.abs(dx) > Math.abs(dy)) this.tel.damageBySide[dx < 0 ? "left" : "right"] += d;
    else this.tel.damageBySide[dy < 0 ? "top" : "bottom"] += d;
    if (this.dashCharges > 0) this.tel.hitsWhileDashReady++;
    this.lastDamageT = this.time;
    this.iframe = dot ? 0.05 : 0.62;
    this.hurtFlash = dot ? 0.3 : 1;
    this.combo = 0;
    if (!dot) {
      this.addShake(11);
      sfx.hurt();
      this.freeze = 0.05;
      this.burst(this.px, this.py, 18, "#ff4d6d", 260, 3.5, 0.45);
      this.floater(this.px, this.py - 34, `-${Math.round(d)}`, "#ff4d6d", 16);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.killedBy = source;
      this.deathT = 0;
      this.addShake(26);
      this.freeze = 0.2;
      this.whiteFlash = 1;
      sfx.death();
      this.burst(this.px, this.py, 90, this.theme.pal.player, 520, 5, 1.2);
      this.comment(`Subject terminated by ${source}. Compiling autopsy.`, "pressure");
    }
  }

  // ---------------------------------------------------------------- telemetry
  private sampleTelemetry(dt: number) {
    this.telemetryTimer += dt;
    this.dodgeCd -= dt;
    if (this.telemetryTimer < 0.2) return;
    this.telemetryTimer = 0;
    const e = this.nearestEnemy();
    if (e) {
      const gap = Math.hypot(e.x - this.px, e.y - this.py);
      this.tel.avgEnemyGap =
        (this.tel.avgEnemyGap * this.tel.gapSamples + gap) / (this.tel.gapSamples + 1);
      this.tel.gapSamples++;
    }
    // dodge direction: moving away from a close threat
    const speed = Math.hypot(this.pvx, this.pvy);
    let threat = false;
    for (const b of this.ebullets) {
      if (Math.hypot(b.x - this.px, b.y - this.py) < 150) {
        threat = true;
        break;
      }
    }
    if (!threat && e && Math.hypot(e.x - this.px, e.y - this.py) < 170) threat = true;
    if (threat && e && speed > 90 && this.dodgeCd <= 0) {
      this.dodgeCd = 0.45;
      if (Math.abs(this.pvx) > Math.abs(this.pvy) * 0.6) {
        if (this.pvx < -20) this.tel.dodgeLeft++;
        else if (this.pvx > 20) this.tel.dodgeRight++;
      } else {
        // vertical dodge: attribute to horizontal escape intention of nearest threat
        if (e.x < this.px) this.tel.dodgeRight++;
        else this.tel.dodgeLeft++;
      }
    }
    this.tel.score = this.score;
    this.tel.peakCombo = this.peakCombo;
  }

  // ---------------------------------------------------------------- finish
  private finish(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.tel.timeAlive = this.time;
    this.tel.score = this.score;
    this.tel.sector = Math.min(this.sector, this.cfg.sectors);
    this.tel.peakCombo = this.peakCombo;
    const noCounter = won && this.cfg.threat >= 8;
    const shards = Math.max(
      1,
      Math.round(
        (this.score / 420 + this.sector * 4 + this.cfg.threat * 3 + (won ? 40 : 0)) *
          (1 + 0.25 * (this.meta.upgrades.salvage ?? 0)) *
          (this.cfg.hardcore ? 1.6 : 1),
      ),
    );
    if (won) sfx.win();
    const result: RunResult = {
      won,
      score: this.score,
      sector: Math.min(this.sector, this.cfg.sectors),
      sectorsTotal: this.cfg.sectors,
      timeAlive: this.time,
      kills: this.kills,
      peakCombo: this.peakCombo,
      shards,
      weapon: this.weaponId,
      threat: this.cfg.threat,
      telemetry: this.tel,
      causeOfDeath: won
        ? "SECTOR OBJECTIVE COMPLETE"
        : `TERMINATED BY ${this.killedBy} · ${(100 * (this.hp / this.maxHp)).toFixed(0)}% INTEGRITY REMAINING`,
      killedBy: this.killedBy,
      noCounter,
    };
    this.cb.onEnd(result);
  }

  // ---------------------------------------------------------------- HUD
  private emitHud() {
    const h: HudState = {
      hp: this.hp,
      maxHp: this.maxHp,
      shield: this.shield,
      score: this.score,
      combo: this.combo,
      comboFrac: clamp(this.comboT / 2.6, 0, 1),
      sector: Math.min(this.sector, this.cfg.sectors),
      sectorsTotal: this.cfg.sectors,
      sectorFrac: clamp(this.sectorKills / this.sectorQuota, 0, 1),
      dashFrac: this.dashCharges >= this.maxDash ? 1 : 1 - clamp(this.dashCd / 1.45, 0, 1),
      dashCharges: this.dashCharges,
      maxDash: this.maxDash,
      threat: this.cfg.threat,
      pressure: clamp(this.pressure, 0, 1),
      weapon: WEAPONS[this.weaponId].name,
      overdrive: Math.max(0, this.overdrive),
      slowmo: 0,
      enemiesLeft: this.enemies.length,
      banner: this.banner,
      bannerSub: this.bannerSub,
      bannerT: this.bannerT,
    };
    this.cb.onHud(h);
  }

  // ---------------------------------------------------------------- render
  private scanPattern: CanvasPattern | null = null;
  private bgGrad: CanvasGradient | null = null;
  private bgGradH = -1;

  private render(dt: number) {
    const ctx = this.ctx;
    const pal = this.theme.pal;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.bgGrad || this.bgGradH !== h) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(1, pal.bg0);
      this.bgGrad = g;
      this.bgGradH = h;
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, w, h);

    const sx = this.shake > 0 ? (this.rng() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (this.rng() - 0.5) * this.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.ox + sx, this.oy + sy);
    ctx.scale(this.scale, this.scale);

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.grid;
    const step = 64;
    const off = (this.time * 8) % step;
    ctx.beginPath();
    for (let x = this.bx0 - off; x < this.bx1 + step; x += step) {
      ctx.moveTo(x, this.by0);
      ctx.lineTo(x, this.by1);
    }
    for (let y = this.by0 - off; y < this.by1 + step; y += step) {
      ctx.moveTo(this.bx0, y);
      ctx.lineTo(this.bx1, y);
    }
    ctx.stroke();

    // arena border
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.28 + pulse * 0.16;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.bx0, this.by0, this.bx1 - this.bx0, this.by1 - this.by0);
    ctx.globalAlpha = 1;

    // zones
    for (const z of this.zones) {
      if (z.kind === "null") {
        ctx.strokeStyle = "rgba(129,140,248,0.55)";
        ctx.fillStyle = "rgba(79,70,229,0.10)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const a = this.time * 1.4;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * 0.55 + Math.sin(a) * 12, 0, TAU);
        ctx.stroke();
      } else {
        const grd = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
        grd.addColorStop(0, "rgba(192,132,252,0.5)");
        grd.addColorStop(1, "rgba(192,132,252,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(192,132,252,0.5)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(z.x, z.y, 20 + ((this.time * 60 + i * 40) % z.r), 0, TAU);
          ctx.stroke();
        }
      }
    }

    // pickups
    for (const p of this.pickups) {
      const c = p.type === "hp" ? "#4ade80" : p.type === "shield" ? "#60a5fa" : p.type === "overdrive" ? "#fbbf24" : p.type === "nuke" ? "#ff4d6d" : "#c084fc";
      const s = 9 + Math.sin(p.t * 6) * 1.6;
      ctx.globalAlpha = p.life < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(p.life * 8)) : 1;
      ctx.fillStyle = c;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 1.6);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const rr = i % 2 === 0 ? s : s * 0.55;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = "lighter";

    // enemy bullets
    for (const b of this.ebullets) {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }

    // player bullets
    for (const b of this.bullets) {
      const len = Math.min(26, Math.hypot(b.vx, b.vy) * 0.028);
      const a = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = b.r * 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = b.r;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // particles
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + a * 0.6);
      if (p.max > 0.45) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      const spawnA = e.spawnT > 0 ? 1 - e.spawnT / 0.45 : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.kind === "turret" ? e.t * 0.6 : e.angle);
      ctx.globalAlpha = clamp(spawnA, 0.15, 1);
      const col = e.flash > 0 ? "#ffffff" : e.def.color;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 2;
      const r = e.r * (0.6 + 0.4 * clamp(spawnA, 0, 1));

      if (e.kind === "chaser") {
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.7, r * 0.75);
        ctx.lineTo(-r * 0.35, 0);
        ctx.lineTo(-r * 0.7, -r * 0.75);
        ctx.closePath();
        ctx.stroke();
      } else if (e.kind === "swarm") {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
      } else if (e.kind === "shooter") {
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.lineTo(0, -r);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, TAU);
        ctx.fill();
      } else if (e.kind === "orbiter") {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, TAU);
        ctx.stroke();
      } else if (e.kind === "charger") {
        const tele = e.state === 1;
        ctx.lineWidth = tele ? 3 + Math.sin(e.t * 40) * 1.6 : 2;
        ctx.beginPath();
        ctx.moveTo(r * 1.4, 0);
        ctx.lineTo(-r, r * 0.7);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r, -r * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else if (e.kind === "splitter") {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.3, r * 0.35, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r * 0.3, r * 0.32, r * 0.32, 0, TAU);
        ctx.stroke();
      } else if (e.kind === "turret") {
        const n = e.elite ? 8 : 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(r * 1.5, 0);
        ctx.lineTo(-r * 0.5, r * 0.55);
        ctx.lineTo(-r * 0.5, -r * 0.55);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // telegraph markers
      if (e.kind === "charger" && e.state === 1) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(e.t * 30);
        ctx.strokeStyle = e.def.color;
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 520, e.y + Math.sin(e.angle) * 520);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (e.kind === "assassin" && e.state === 1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 14 + Math.sin(e.t * 24) * 6, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }

      // hp bar for tanky units
      if (e.maxHp > 45 || e.elite) {
        const bw = e.r * 2.4;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw, 4);
        ctx.fillStyle = e.elite ? "#ff4d6d" : e.def.color;
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
        ctx.globalAlpha = 1;
      }
    }

    // player
    if (this.alive) {
      ctx.save();
      ctx.translate(this.px, this.py);
      // aim guide
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = WEAPONS[this.weaponId].color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.moveTo(Math.cos(this.aim) * 26, Math.sin(this.aim) * 26);
      ctx.lineTo(Math.cos(this.aim) * 240, Math.sin(this.aim) * 240);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.rotate(this.aim);
      // engine trail
      const thr = 8 + Math.hypot(this.pvx, this.pvy) * 0.02;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pal.player;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-this.pr - 2, 5);
      ctx.lineTo(-this.pr - thr, 0);
      ctx.lineTo(-this.pr - 2, -5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = this.iframe > 0 && Math.floor(this.time * 20) % 2 === 0 ? "#ffffff" : pal.player;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.pr * 1.5, 0);
      ctx.lineTo(-this.pr * 0.85, this.pr * 0.9);
      ctx.lineTo(-this.pr * 0.4, 0);
      ctx.lineTo(-this.pr * 0.85, -this.pr * 0.9);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      if (this.shield > 0) {
        ctx.strokeStyle = "#60a5fa";
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(this.time * 5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.px, this.py, this.pr + 11, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.overdrive > 0) {
        ctx.strokeStyle = "#fbbf24";
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.px, this.py, this.pr + 19 + Math.sin(this.time * 9) * 3, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // floaters
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life / 0.85, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = `700 ${f.size}px ui-monospace, monospace`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // blackout overlay
    if (this.cfg.hazard === "blackout") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const grd = ctx.createRadialGradient(this.px, this.py, 60, this.px, this.py, 330);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.6, "rgba(0,0,0,0.72)");
      grd.addColorStop(1, "rgba(0,0,0,0.94)");
      ctx.fillStyle = grd;
      ctx.fillRect(this.bx0 - 200, this.by0 - 200, this.bx1 - this.bx0 + 400, this.by1 - this.by0 + 400);
      ctx.restore();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // damage vignette
    if (this.hurtFlash > 0) {
      const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
      grd.addColorStop(0, "rgba(255,0,60,0)");
      grd.addColorStop(1, `rgba(255,0,60,${0.5 * this.hurtFlash})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
    // low hp pulse
    const frac = this.hp / this.maxHp;
    if (this.alive && frac < 0.3) {
      const p = (0.16 + 0.1 * Math.sin(this.time * 6)) * (1 - frac / 0.3);
      const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      grd.addColorStop(0, "rgba(255,0,60,0)");
      grd.addColorStop(1, `rgba(255,0,60,${p})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, this.whiteFlash * 0.6)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // scanlines via cached pattern (single fill)
    if (!this.scanPattern) {
      const pc = document.createElement("canvas");
      pc.width = 1;
      pc.height = 4;
      const pctx = pc.getContext("2d");
      if (pctx) {
        pctx.fillStyle = "rgba(0,0,0,0.55)";
        pctx.fillRect(0, 2, 1, 2);
        this.scanPattern = ctx.createPattern(pc, "repeat");
      }
    }
    if (this.scanPattern) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    void dt;
  }

}
