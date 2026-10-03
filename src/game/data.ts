import type { EnemyDef, EnemyKind, HazardId, WeaponDef, WeaponId } from "./types";

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pulse: {
    id: "pulse",
    name: "PULSE",
    glyph: "◈",
    blurb: "Reliable rapid bolts. Balanced in every dimension.",
    cd: 0.135,
    dmg: 10,
    speed: 780,
    count: 1,
    spread: 0.03,
    size: 4.5,
    pierce: 0,
    color: "#5ffbf1",
    kick: 40,
    life: 1.1,
  },
  scatter: {
    id: "scatter",
    name: "SCATTER",
    glyph: "⁂",
    blurb: "Five-pellet burst. Devastating up close, useless far away.",
    cd: 0.46,
    dmg: 7,
    speed: 660,
    count: 5,
    spread: 0.42,
    size: 3.6,
    pierce: 0,
    color: "#ffd166",
    kick: 190,
    life: 0.42,
  },
  rail: {
    id: "rail",
    name: "RAIL",
    glyph: "⟶",
    blurb: "Charged piercing beam. Punches through entire formations.",
    cd: 0.78,
    dmg: 30,
    speed: 2400,
    count: 1,
    spread: 0,
    size: 5,
    pierce: 6,
    color: "#c084fc",
    kick: 150,
    life: 0.6,
    beam: true,
  },
  arc: {
    id: "arc",
    name: "ARC",
    glyph: "⚡",
    blurb: "Hyper-cadence micro bolts with light homing. Shred swarms.",
    cd: 0.07,
    dmg: 5,
    speed: 700,
    count: 1,
    spread: 0.16,
    size: 3,
    pierce: 0,
    color: "#7dd3fc",
    kick: 18,
    life: 0.85,
  },
  nova: {
    id: "nova",
    name: "NOVA",
    glyph: "◎",
    blurb: "Slow orbs that detonate on impact for area damage.",
    cd: 0.5,
    dmg: 16,
    speed: 420,
    count: 2,
    spread: 0.18,
    size: 8,
    pierce: 0,
    color: "#fb7185",
    kick: 120,
    life: 1.4,
  },
};

export const WEAPON_ORDER: WeaponId[] = ["pulse", "scatter", "rail", "arc", "nova"];

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  chaser: {
    kind: "chaser",
    name: "RUSHER",
    hp: 26,
    r: 15,
    speed: 148,
    dmg: 12,
    score: 100,
    color: "#ff4d6d",
    minThreat: 1,
    weight: 10,
  },
  swarm: {
    kind: "swarm",
    name: "MITES",
    hp: 9,
    r: 9,
    speed: 205,
    dmg: 7,
    score: 45,
    color: "#4ade80",
    minThreat: 1,
    weight: 7,
  },
  shooter: {
    kind: "shooter",
    name: "SPITTER",
    hp: 30,
    r: 16,
    speed: 88,
    dmg: 10,
    score: 150,
    fireCd: 1.5,
    color: "#a78bfa",
    minThreat: 1,
    weight: 8,
  },
  orbiter: {
    kind: "orbiter",
    name: "ORBITER",
    hp: 40,
    r: 17,
    speed: 155,
    dmg: 12,
    score: 220,
    fireCd: 1.9,
    color: "#fbbf24",
    minThreat: 3,
    weight: 6,
  },
  charger: {
    kind: "charger",
    name: "LANCER",
    hp: 44,
    r: 18,
    speed: 120,
    dmg: 18,
    score: 250,
    color: "#fb923c",
    minThreat: 3,
    weight: 5,
  },
  splitter: {
    kind: "splitter",
    name: "SPLITTER",
    hp: 46,
    r: 20,
    speed: 105,
    dmg: 12,
    score: 200,
    color: "#34d399",
    minThreat: 4,
    weight: 5,
  },
  turret: {
    kind: "turret",
    name: "BASTION",
    hp: 90,
    r: 22,
    speed: 0,
    dmg: 14,
    score: 320,
    fireCd: 2.4,
    color: "#94a3b8",
    minThreat: 5,
    weight: 4,
  },
  assassin: {
    kind: "assassin",
    name: "WRAITH",
    hp: 34,
    r: 14,
    speed: 190,
    dmg: 22,
    score: 420,
    color: "#f8fafc",
    minThreat: 6,
    weight: 3,
  },
};

export const HAZARDS: Record<HazardId, { name: string; blurb: string; icon: string }> = {
  none: { name: "CLEAN ARENA", blurb: "No environmental interference.", icon: "□" },
  nullzones: {
    name: "NULL ZONES",
    blurb: "Drag fields that slow you to a crawl. Route around them.",
    icon: "◍",
  },
  gravitywells: {
    name: "GRAVITY WELLS",
    blurb: "Singularities pull you and your bullets off course.",
    icon: "◉",
  },
  blackout: {
    name: "BLACKOUT PROTOCOL",
    blurb: "Vision restricted to your muzzle radius. Sound is your radar.",
    icon: "◑",
  },
  shrink: {
    name: "COLLAPSE FIELD",
    blurb: "The arena contracts. Standing ground is death.",
    icon: "⋙",
  },
  mirrorshards: {
    name: "MIRROR SHARDS",
    blurb: "Bouncing bullets everywhere. Nothing is safe to stand behind.",
    icon: "⧉",
  },
};

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  costs: number[];
  effect: string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "vitality",
    name: "VITALITY CORE",
    desc: "+14% maximum integrity per rank.",
    icon: "✚",
    costs: [40, 90, 180],
    effect: "+14% HP",
  },
  {
    id: "reflex",
    name: "REFLEX GATE",
    desc: "+1 dash charge. Dash grants invulnerability frames.",
    icon: "⇉",
    costs: [120, 260],
    effect: "+1 DASH",
  },
  {
    id: "coolant",
    name: "COOLANT LOOP",
    desc: "-12% weapon cooldown per rank.",
    icon: "❄",
    costs: [70, 150, 280],
    effect: "-12% CD",
  },
  {
    id: "magnet",
    name: "SALVAGE MAGNET",
    desc: "+70% pickup collection radius per rank.",
    icon: "⊙",
    costs: [50, 110],
    effect: "+70% PICKUP",
  },
  {
    id: "plating",
    name: "ABLATIVE PLATING",
    desc: "-12% damage taken per rank.",
    icon: "⛊",
    costs: [90, 190, 330],
    effect: "-12% DMG",
  },
  {
    id: "autodoct",
    name: "AUTO-DOCTOR",
    desc: "Repair 12 integrity on every sector clear.",
    icon: "⌁",
    costs: [80, 170],
    effect: "HEAL / SECTOR",
  },
  {
    id: "barrier",
    name: "PHASE BARRIER",
    desc: "Begin each run with a full shield.",
    icon: "֍",
    costs: [150],
    effect: "START SHIELD",
  },
  {
    id: "overclock",
    name: "OVERCLOCK",
    desc: "+10% move speed and +8% score gain per rank.",
    icon: "⤴",
    costs: [60, 140, 260],
    effect: "+SPEED/SCORE",
  },
  {
    id: "salvage",
    name: "SHARD REFINERY",
    desc: "+25% data shards harvested per rank.",
    icon: "◆",
    costs: [55, 130],
    effect: "+25% SHARDS",
  },
];

export interface ThemeDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  swatch: string[];
  pal: {
    bg0: string;
    bg1: string;
    grid: string;
    player: string;
    accent: string;
    text: string;
    danger: string;
  };
}

export const THEMES: ThemeDef[] = [
  {
    id: "cyber",
    name: "NEON PROTOCOL",
    price: 0,
    desc: "Default. Cyan glitch on void black.",
    swatch: ["#05060d", "#5ffbf1", "#c084fc"],
    pal: {
      bg0: "#05060d",
      bg1: "#0b0f22",
      grid: "rgba(95,251,241,0.07)",
      player: "#5ffbf1",
      accent: "#5ffbf1",
      text: "#e8fbff",
      danger: "#ff4d6d",
    },
  },
  {
    id: "retro",
    name: "CRT ARCADE",
    price: 0,
    desc: "Green phosphor and scanlines. Free.",
    swatch: ["#04120a", "#39ff14", "#ffd166"],
    pal: {
      bg0: "#040d09",
      bg1: "#07160f",
      grid: "rgba(57,255,20,0.08)",
      player: "#39ff14",
      accent: "#39ff14",
      text: "#d8ffd0",
      danger: "#ff5f56",
    },
  },
  {
    id: "horror",
    name: "BLOOD HARVEST",
    price: 0,
    desc: "Unlocked from the AI Theme store.",
    swatch: ["#0d0405", "#ff3b3b", "#f5e6c8"],
    pal: {
      bg0: "#0a0304",
      bg1: "#150709",
      grid: "rgba(255,59,59,0.07)",
      player: "#f5e6c8",
      accent: "#ff3b3b",
      text: "#f7e9e9",
      danger: "#ff3b3b",
    },
  },
];

export const PICKUP_INFO: Record<string, { name: string; color: string; icon: string }> = {
  hp: { name: "REPAIR", color: "#4ade80", icon: "✚" },
  shield: { name: "SHIELD", color: "#60a5fa", icon: "֍" },
  overdrive: { name: "OVERDRIVE", color: "#fbbf24", icon: "⚡" },
  shard: { name: "DATA SHARD", color: "#c084fc", icon: "◆" },
  nuke: { name: "PURGE", color: "#ff4d6d", icon: "✹" },
};
