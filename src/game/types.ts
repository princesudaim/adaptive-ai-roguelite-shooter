export type EnemyKind =
  | "chaser"
  | "shooter"
  | "swarm"
  | "orbiter"
  | "charger"
  | "splitter"
  | "turret"
  | "assassin";

export type WeaponId = "pulse" | "scatter" | "rail" | "arc" | "nova";

export type HazardId =
  | "none"
  | "nullzones"
  | "gravitywells"
  | "blackout"
  | "shrink"
  | "mirrorshards";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  glyph: string;
  blurb: string;
  cd: number; // seconds between shots
  dmg: number;
  speed: number; // projectile speed
  count: number; // projectiles per shot
  spread: number; // radians
  size: number;
  pierce: number;
  color: string;
  kick: number;
  life: number; // projectile lifetime
  beam?: boolean;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  r: number;
  speed: number;
  dmg: number;
  score: number;
  fireCd?: number;
  color: string;
  minThreat: number;
  weight: number;
}

export interface RunTelemetry {
  dodgeLeft: number;
  dodgeRight: number;
  shotsFired: number;
  shotsHit: number;
  damageDealt: number;
  damageTaken: number;
  damageBySource: Record<string, number>;
  damageBySide: { left: number; right: number; top: number; bottom: number };
  killsByType: Record<string, number>;
  pickupsSpawned: number;
  pickupsTaken: number;
  dashesUsed: number;
  hitsWhileDashReady: number;
  nearMisses: number;
  closestCall: number;
  distTravelled: number;
  timeLowHp: number;
  timeNearWall: number;
  timeInMotion: number;
  avgEnemyGap: number;
  gapSamples: number;
  killsAtLowHp: number;
  timeAlive: number;
  score: number;
  sector: number;
  peakCombo: number;
  weapon: WeaponId;
}

export interface Directive {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tag: "target" | "pressure" | "novelty" | "denial";
}

export interface RunConfig {
  threat: number; // 1..10
  seed: number;
  weaponOffers: WeaponId[];
  bannedWeapon: WeaponId | null;
  hazard: HazardId;
  enemyWeights: Partial<Record<EnemyKind, number>>;
  hpMult: number;
  speedMult: number;
  fireRateMult: number;
  bulletSpeedMult: number;
  spawnRateMult: number;
  pickupRate: number;
  spawnSideBias: "left" | "right" | "top" | "bottom" | null;
  flankers: boolean;
  sectors: number;
  quotas: number[];
  directives: Directive[];
  objective: string;
  aiConfidence: number;
  hardcore: boolean;
  flowTarget: number;
}

export interface RunResult {
  won: boolean;
  score: number;
  sector: number;
  sectorsTotal: number;
  timeAlive: number;
  kills: number;
  peakCombo: number;
  shards: number;
  weapon: WeaponId;
  threat: number;
  telemetry: RunTelemetry;
  causeOfDeath: string;
  killedBy: string;
  noCounter: boolean;
}

export interface MetaState {
  shards: number;
  upgrades: Record<string, number>;
  theme: string;
  unlockedThemes: string[];
  hardcore: boolean;
  autofire: boolean;
  screenShake: boolean;
  threat: number;
  defeated: boolean;
  runsPlayed: number;
  history: RunResult[];
  scores: { score: number; threat: number; weapon: WeaponId; sector: number; date: number }[];
}

export interface HudState {
  hp: number;
  maxHp: number;
  shield: number;
  score: number;
  combo: number;
  comboFrac: number;
  sector: number;
  sectorsTotal: number;
  sectorFrac: number;
  dashFrac: number;
  dashCharges: number;
  maxDash: number;
  threat: number;
  pressure: number;
  weapon: string;
  overdrive: number;
  slowmo: number;
  enemiesLeft: number;
  banner: string;
  bannerSub: string;
  bannerT: number;
}

export interface AiComment {
  id: number;
  text: string;
  tone: "calibrate" | "adapt" | "pressure" | "praise";
}
