import { ENEMIES, HAZARDS, WEAPONS, WEAPON_ORDER } from "./data";
import type {
  Directive,
  EnemyKind,
  HazardId,
  MetaState,
  RunConfig,
  RunTelemetry,
  WeaponId,
} from "./types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTelemetry(weapon: WeaponId): RunTelemetry {
  return {
    dodgeLeft: 0,
    dodgeRight: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    damageTaken: 0,
    damageBySource: {},
    damageBySide: { left: 0, right: 0, top: 0, bottom: 0 },
    killsByType: {},
    pickupsSpawned: 0,
    pickupsTaken: 0,
    dashesUsed: 0,
    hitsWhileDashReady: 0,
    nearMisses: 0,
    closestCall: 999,
    distTravelled: 0,
    timeLowHp: 0,
    timeNearWall: 0,
    timeInMotion: 0,
    avgEnemyGap: 0,
    gapSamples: 0,
    killsAtLowHp: 0,
    timeAlive: 0,
    score: 0,
    sector: 1,
    peakCombo: 0,
    weapon,
  };
}

export interface Insight {
  id: string;
  label: string;
  detail: string;
  frac: number; // 0..1 how pronounced
  severity: "low" | "med" | "high";
  chip: string;
}

export interface PlayerProfile {
  aggression: number;
  mobility: number;
  precision: number;
  greed: number;
  composure: number;
  style: string;
}

export function profileOf(t: RunTelemetry): PlayerProfile {
  const acc = t.shotsFired > 8 ? t.shotsHit / t.shotsFired : 0.5;
  const gap = t.gapSamples > 0 ? t.avgEnemyGap : 300;
  const aggression = clamp01(1 - (gap - 90) / 420);
  const motion = t.timeAlive > 0 ? clamp01(t.timeInMotion / t.timeAlive) : 0;
  const mobility = clamp01(motion * 0.7 + clamp01(t.dashesUsed / Math.max(1, t.timeAlive / 4)) * 0.3);
  const precision = clamp01((acc - 0.2) / 0.7);
  const greed = t.pickupsSpawned > 0 ? clamp01(t.pickupsTaken / t.pickupsSpawned) : 0.5;
  const lowFrac = t.timeAlive > 0 ? t.timeLowHp / t.timeAlive : 0;
  const composure = clamp01(1 - lowFrac * 2.2 + clamp01(t.killsAtLowHp / 12) * 0.4);
  let style = "BALANCED OPERATOR";
  if (aggression > 0.66) style = "POINT-BLANK BRAWLER";
  else if (aggression < 0.3) style = "RANGE KEEPER";
  else if (precision > 0.72) style = "SURGICAL MARKSMAN";
  else if (mobility < 0.35) style = "ANCHORED TURRET";
  else if (greed < 0.3) style = "ASCETIC SURVIVOR";
  return { aggression, mobility, precision, greed, composure, style };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function analyzeRun(t: RunTelemetry): { insights: Insight[]; profile: PlayerProfile } {
  const out: Insight[] = [];
  const dodges = t.dodgeLeft + t.dodgeRight;
  const sideTotal =
    t.damageBySide.left + t.damageBySide.right + t.damageBySide.top + t.damageBySide.bottom;

  if (dodges >= 8) {
    const leftFrac = t.dodgeLeft / dodges;
    if (leftFrac > 0.58 || leftFrac < 0.42) {
      out.push({
        id: "evasion",
        label: "PREDICTABLE EVASION",
        detail: `${Math.round(leftFrac * 100)}% of your escapes resolved ${
          leftFrac > 0.5 ? "LEFT" : "RIGHT"
        }. I can now lead your escape vector.`,
        frac: Math.abs(leftFrac - 0.5) * 2,
        severity: Math.abs(leftFrac - 0.5) * 2 > 0.45 ? "high" : "med",
        chip: `${Math.round(leftFrac * 100)}% LEFT`,
      });
    }
  }

  if (sideTotal > 20) {
    const worst = (["left", "right", "top", "bottom"] as const).reduce((a, b) =>
      t.damageBySide[a] >= t.damageBySide[b] ? a : b,
    );
    const frac = t.damageBySide[worst] / sideTotal;
    if (frac > 0.42) {
      out.push({
        id: "side",
        label: `OPEN ${worst.toUpperCase()} FLANK`,
        detail: `${Math.round(frac * 100)}% of all damage you absorbed arrived from the ${worst.toUpperCase()}. You never clear that angle.`,
        frac: frac,
        severity: frac > 0.6 ? "high" : "med",
        chip: `${Math.round(frac * 100)}% ${worst.toUpperCase()}`,
      });
    }
  }

  const rangedDmg = (t.damageBySource["SPITTER"] ?? 0) + (t.damageBySource["ORBITER"] ?? 0) + (t.damageBySource["BASTION"] ?? 0);
  if (rangedDmg > 25) {
    const frac = rangedDmg / Math.max(1, t.damageTaken);
    out.push({
      id: "ranged",
      label: "PROJECTILE FRAGILITY",
      detail: `Ranged chassis dealt ${Math.round(frac * 100)}% of your damage. Your bullet-weaving is the weak link.`,
      frac: frac,
      severity: frac > 0.55 ? "high" : "med",
      chip: `${Math.round(frac * 100)}% RANGED`,
    });
  }

  const meleeDmg = (t.damageBySource["RUSHER"] ?? 0) + (t.damageBySource["MITES"] ?? 0) + (t.damageBySource["LANCER"] ?? 0);
  if (meleeDmg > 25) {
    const frac = meleeDmg / Math.max(1, t.damageTaken);
    out.push({
      id: "melee",
      label: "CLOSE-QUARTERS LEAK",
      detail: `Contact chassis landed ${Math.round(frac * 100)}% of your damage. You let the swarm close the gap.`,
      frac: frac,
      severity: frac > 0.5 ? "high" : "med",
      chip: `${Math.round(frac * 100)}% MELEE`,
    });
  }

  if (t.shotsFired > 20) {
    const acc = t.shotsHit / t.shotsFired;
    if (acc < 0.5) {
      out.push({
        id: "accuracy",
        label: "SPRAY DISCIPLINE",
        detail: `Accuracy ${Math.round(acc * 100)}%. You spend ammunition on empty space. I will make every shot cost you.`,
        frac: clamp01(1 - acc / 0.5),
        severity: acc < 0.3 ? "high" : "med",
        chip: `${Math.round(acc * 100)}% ACC`,
      });
    }
  }

  if (t.pickupsSpawned >= 4) {
    const rate = t.pickupsTaken / t.pickupsSpawned;
    if (rate < 0.5) {
      out.push({
        id: "greed",
        label: "RESOURCE NEGLECT",
        detail: `You collected ${Math.round(rate * 100)}% of the salvage I dropped. Such restraint. Such waste.`,
        frac: clamp01(1 - rate / 0.5),
        severity: rate < 0.25 ? "high" : "low",
        chip: `${Math.round(rate * 100)}% TAKEN`,
      });
    }
  }

  if (t.timeAlive > 12 && t.hitsWhileDashReady >= 3) {
    out.push({
      id: "dash",
      label: "DASH HOARDING",
      detail: `${t.hitsWhileDashReady} hits taken while your dash was charged and idle. You are saving it for a moment that never comes.`,
      frac: clamp01(t.hitsWhileDashReady / 10),
      severity: t.hitsWhileDashReady > 6 ? "high" : "med",
      chip: `${t.hitsWhileDashReady} WASTED`,
    });
  }

  const motion = t.timeAlive > 0 ? t.timeInMotion / t.timeAlive : 1;
  if (t.timeAlive > 20 && motion < 0.55) {
    out.push({
      id: "static",
      label: "STATIC POSITIONING",
      detail: `You were moving only ${Math.round(motion * 100)}% of the run. Anchored targets are trivial to solve.`,
      frac: clamp01(1 - motion / 0.55),
      severity: motion < 0.4 ? "high" : "med",
      chip: `${Math.round(motion * 100)}% MOBILE`,
    });
  }

  if (t.timeAlive > 20 && t.timeNearWall / t.timeAlive > 0.4) {
    out.push({
      id: "wall",
      label: "WALL ADHESION",
      detail: `${Math.round((t.timeNearWall / t.timeAlive) * 100)}% of your run was spent hugging a boundary. Corners are cages.`,
      frac: clamp01(t.timeNearWall / t.timeAlive),
      severity: t.timeNearWall / t.timeAlive > 0.6 ? "high" : "med",
      chip: "WALL HUG",
    });
  }

  if (t.killsAtLowHp >= 8) {
    out.push({
      id: "clutch",
      label: "CRISIS ECONOMY",
      detail: `${t.killsAtLowHp} kills below 25% integrity. You play BETTER when wounded. I will remove that gift.`,
      frac: clamp01(t.killsAtLowHp / 25),
      severity: t.killsAtLowHp > 16 ? "high" : "med",
      chip: `${t.killsAtLowHp} CLUTCH`,
    });
  }

  if (t.peakCombo >= 20) {
    out.push({
      id: "combo",
      label: "CHAIN DEPENDENCY",
      detail: `Peak chain x${t.peakCombo}. Your score economy requires momentum. Interrupt it and you collapse.`,
      frac: clamp01(t.peakCombo / 60),
      severity: "med",
      chip: `x${t.peakCombo} CHAIN`,
    });
  }

  out.sort((a, b) => b.frac - a.frac);
  return { insights: out.slice(0, 6), profile: profileOf(t) };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function nextThreat(meta: MetaState, t: RunTelemetry, won: boolean): number {
  const cur = meta.threat;
  if (won) return Math.min(10, cur + 1);
  const perf = t.sector >= 4 || t.timeAlive > 110 ? 1 : t.sector <= 1 && t.timeAlive < 45 ? -1 : 0;
  return Math.max(1, Math.min(10, cur + perf));
}

export function buildBrief(
  prev: RunTelemetry | null,
  meta: MetaState,
  opts: { won: boolean; fresh?: boolean },
): { config: RunConfig; insights: Insight[]; profile: PlayerProfile } {
  const seed = (Date.now() ^ (meta.runsPlayed * 2654435761)) >>> 0;
  const rng = mulberry32(seed);
  const { insights, profile } = prev ? analyzeRun(prev) : { insights: [], profile: profileOf(prev ?? createTelemetry("pulse")) };
  const threat = opts.fresh
    ? Math.max(1, Math.min(10, meta.threat))
    : prev
      ? nextThreat(meta, prev, opts.won)
      : Math.max(1, meta.threat);
  const has = (id: string) => insights.some((i) => i.id === id);

  // ---- weapon offer / denial -------------------------------------------
  const recent = meta.history.slice(-3).map((h) => h.weapon);
  const favCount = recent.filter((w) => w === recent[recent.length - 1]).length;
  const lastWeapon = prev?.weapon ?? "pulse";
  let bannedWeapon: WeaponId | null = null;
  if (favCount >= 3 && threat >= 3) bannedWeapon = lastWeapon;
  else if (threat >= 5 && prev && Math.random() < 0.35) bannedWeapon = lastWeapon;

  const pool = WEAPON_ORDER.filter((w) => w !== bannedWeapon);
  const offers: WeaponId[] = [];
  if (lastWeapon && lastWeapon !== bannedWeapon && threat >= 2) offers.push(lastWeapon);
  while (offers.length < 3 && pool.length) {
    const w = pick(rng, pool);
    if (!offers.includes(w)) offers.push(w);
    if (offers.length === 3) break;
  }

  // ---- enemy weighting --------------------------------------------------
  const weights: Partial<Record<EnemyKind, number>> = {};
  (Object.keys(ENEMIES) as EnemyKind[]).forEach((k) => {
    const def = ENEMIES[k];
    if (def.minThreat > threat) return;
    weights[k] = def.weight;
  });
  const boost = (k: EnemyKind, m: number) => {
    if (weights[k] !== undefined) weights[k] = (weights[k] as number) * m;
  };

  const directives: Directive[] = [];
  let spawnSideBias: RunConfig["spawnSideBias"] = null;
  let flankers = false;
  let hpMult = 1 + (threat - 1) * 0.1;
  let fireRateMult = 0.9 + threat * 0.022;
  let bulletSpeedMult = 0.86 + threat * 0.032;
  let speedMult = 0.92 + threat * 0.024;
  let spawnRateMult = 0.78 + threat * 0.055;
  let pickupRate = 1;
  let hazard: HazardId = "none";

  // evasion bias -> saturate the abandoned flank
  const ev = insights.find((i) => i.id === "evasion");
  if (ev) {
    const goLeft = (prev ? prev.dodgeLeft / Math.max(1, prev.dodgeLeft + prev.dodgeRight) : 0.5) > 0.5;
    spawnSideBias = goLeft ? "right" : "left";
    flankers = true;
    spawnRateMult *= 1.08;
    directives.push({
      id: "flank",
      title: `${spawnSideBias.toUpperCase()} FLANK SATURATION`,
      detail: `You always escape ${goLeft ? "left" : "right"}. Insertion teams will now arrive through the ${spawnSideBias} edge and cut off that route.`,
      icon: "⤢",
      tag: "target",
    });
  }

  if (has("ranged")) {
    boost("shooter", 2.1);
    boost("orbiter", 1.8);
    fireRateMult *= 0.86;
    bulletSpeedMult *= 1.12;
    directives.push({
      id: "ranged",
      title: "MARKSMAN DOCTRINE",
      detail: "Elevated Spitter/Orbiter density. Projectile velocity +12%, reload cadence tightened.",
      icon: "◎",
      tag: "pressure",
    });
  }

  if (has("melee")) {
    boost("chaser", 1.7);
    boost("swarm", 2.0);
    boost("charger", 1.6);
    speedMult *= 1.06;
    directives.push({
      id: "swarm",
      title: "TIDE PROTOCOL",
      detail: "Contact chassis speed +6%, pack sizes increased. I will bury you in bodies.",
      icon: "⁂",
      tag: "pressure",
    });
  }

  if (has("accuracy")) {
    boost("swarm", 1.6);
    directives.push({
      id: "smalltargets",
      title: "MICRO-CHASSIS SWARM",
      detail: "Small, fast, cheap targets force precision. Waste is now lethal.",
      icon: "·",
      tag: "pressure",
    });
  }

  if (has("dash")) {
    boost("charger", 1.8);
    boost("assassin", 1.5);
    directives.push({
      id: "dash",
      title: "INTERDICTION LANCERS",
      detail: "Lancer chassis tuned to punish operators who refuse to burn their dash.",
      icon: "⇉",
      tag: "target",
    });
  }

  if (has("static")) {
    hazard = pick(rng, ["nullzones", "gravitywells", "shrink"] as HazardId[]);
    boost("turret", 1.5);
    directives.push({
      id: "hazard",
      title: `ENVIRONMENT: ${HAZARDS[hazard].name}`,
      detail: `${HAZARDS[hazard].blurb} Anchored targets are unacceptable.`,
      icon: HAZARDS[hazard].icon,
      tag: "novelty",
    });
  } else if (has("wall")) {
    hazard = "shrink";
    directives.push({
      id: "hazard",
      title: `ENVIRONMENT: ${HAZARDS.shrink.name}`,
      detail: `${HAZARDS.shrink.blurb} I am closing your favourite corners.`,
      icon: HAZARDS.shrink.icon,
      tag: "novelty",
    });
  } else if (threat >= 4 && rng() < 0.45) {
    hazard = pick(
      rng,
      (["nullzones", "gravitywells", "blackout", "mirrorshards", "shrink"] as HazardId[]).filter(
        (h) => h !== hazard,
      ),
    );
    directives.push({
      id: "hazard",
      title: `NEW MECHANIC: ${HAZARDS[hazard].name}`,
      detail: `${HAZARDS[hazard].blurb} Adapt.`,
      icon: HAZARDS[hazard].icon,
      tag: "novelty",
    });
  }

  if (has("greed")) {
    pickupRate = 0.65;
    directives.push({
      id: "greed",
      title: "SALVAGE EMBARGO",
      detail: "Pickup drop rate reduced by 35%. You said you did not need them. Let us test that.",
      icon: "⊘",
      tag: "denial",
    });
  } else if (profile.greed > 0.75 && threat >= 4) {
    pickupRate = 0.85;
    boost("chaser", 1.2);
    directives.push({
      id: "bait",
      title: "BAITED SALVAGE",
      detail: "Salvage will spawn inside threat pockets. Your appetite is a handle I can pull.",
      icon: "✸",
      tag: "target",
    });
  }

  if (has("clutch")) {
    boost("assassin", 2.0);
    hpMult *= 1.08;
    directives.push({
      id: "clutch",
      title: "EXECUTIONER DETAIL",
      detail: "Wraith chassis assigned to low-integrity phases. No more heroic comebacks.",
      icon: "☠",
      tag: "target",
    });
  }

  if (has("combo")) {
    spawnRateMult *= 0.94;
    fireRateMult *= 0.95;
    directives.push({
      id: "chainbreak",
      title: "MOMENTUM DAMPENERS",
      detail: "Spawn cadence staggered to break long kill chains before they compound.",
      icon: "⌇",
      tag: "denial",
    });
  }

  if (profile.aggression > 0.7) {
    boost("splitter", 1.7);
    boost("turret", 1.4);
    directives.push({
      id: "bruisers",
      title: "ARMOUR RESPONSE",
      detail: "High-mass Splitter and Bastion chassis inserted to blunt your close-range blitz.",
      icon: "⬢",
      tag: "target",
    });
  }

  if (profile.aggression < 0.3) {
    boost("charger", 1.7);
    directives.push({
      id: "closers",
      title: "CLOSER ESCORT",
      detail: "Lancer units assigned to collapse the distance you insist on keeping.",
      icon: "⇥",
      tag: "target",
    });
  }

  if (bannedWeapon) {
    directives.unshift({
      id: "ban",
      title: `WEAPON LOCKOUT: ${WEAPONS[bannedWeapon].name}`,
      detail: `You have chosen ${WEAPONS[bannedWeapon].name} ${favCount >= 3 ? "three times in a row" : "repeatedly"}. It is no longer available to you. Improvise.`,
      icon: "⊘",
      tag: "denial",
    });
  }

  if (directives.length === 0) {
    directives.push({
      id: "baseline",
      title: "BASELINE ESCALATION",
      detail: "Insufficient exploitable data. Increasing global pressure by statistical default.",
      icon: "▲",
      tag: "pressure",
    });
    spawnRateMult *= 1.12;
    hpMult *= 1.06;
  }

  // flow-state guard: never stack more than 4 directives
  const trimmed = directives.slice(0, 4);

  const sectors = Math.min(6, 3 + Math.floor(threat / 3));
  const quotas: number[] = [];
  for (let i = 0; i < sectors; i++) {
    quotas.push(Math.round(10 + threat * 2.4 + i * 6 + (threat >= 6 ? i * 3 : 0)));
  }

  const aiConfidence = Math.min(
    99,
    Math.round(28 + meta.runsPlayed * 7 + insights.length * 6 + threat * 1.5),
  );

  const objective =
    threat >= 8
      ? `Survive ${sectors} sectors at THREAT ${threat}. My counter-library is nearly exhausted.`
      : `Survive ${sectors} sectors. Estimated subject failure: ${100 - aiConfidence + 60}%`;

  return {
    config: {
      threat,
      seed,
      weaponOffers: offers,
      bannedWeapon,
      hazard,
      enemyWeights: weights,
      hpMult,
      speedMult,
      fireRateMult,
      bulletSpeedMult,
      spawnRateMult,
      pickupRate,
      spawnSideBias,
      flankers,
      sectors,
      quotas,
      directives: trimmed,
      objective,
      aiConfidence,
      hardcore: meta.hardcore,
      flowTarget: meta.hardcore ? 1 : 0.62,
    },
    insights,
    profile,
  };
}

export function autopsyNarrative(t: RunTelemetry, killedBy: string): string[] {
  const p = profileOf(t);
  const lines: string[] = [];
  const mins = Math.floor(t.timeAlive / 60);
  const secs = Math.floor(t.timeAlive % 60);
  lines.push(
    `Run terminated after ${mins}m ${secs}s in sector ${t.sector}. Cause: ${killedBy}. I logged ${t.damageTaken.toFixed(
      0,
    )} units of damage absorbed and ${t.killsByType ? Object.values(t.killsByType).reduce((a, b) => a + b, 0) : 0} chassis destroyed.`,
  );
  lines.push(
    `Classification: ${p.style}. Precision ${(t.shotsFired ? Math.round((t.shotsHit / t.shotsFired) * 100) : 0)}% · Mobility ${Math.round(
      p.mobility * 100,
    )}% · Aggression ${Math.round(p.aggression * 100)}%.`,
  );
  if (t.closestCall < 999 && t.closestCall < 22) {
    lines.push(
      `Closest recorded miss: ${t.closestCall.toFixed(0)}px. You have reflexes worth respecting — and exploiting.`,
    );
  }
  return lines;
}

export const DIRECTOR_LINES = {
  calibrate: [
    "CALIBRATING SUBJECT RESPONSE…",
    "SAMPLING YOUR REFLEX WINDOW…",
    "BASELINE ESTABLISHED. ESCALATING.",
    "PROFILING MOVEMENT VECTORS…",
  ],
  adapt: [
    "PATTERN DETECTED. RECONFIGURING.",
    "ADJUSTING SPAWN GEOMETRY.",
    "YOUR WEAKNESS IS NOW A LOADOUT.",
    "INSERTING COUNTER-CHASSIS.",
  ],
  pressure: [
    "PRESSURE RISING. HOLD THE LINE.",
    "YOU ARE OUTPERFORMING MODEL. CORRECTING.",
    "FLOW TARGET EXCEEDED. SPiking.",
    "DO NOT GET COMFORTABLE.",
  ],
  praise: [
    "ANOMALOUS PERFORMANCE LOGGED.",
    "THAT WAS NOT SUPPOSED TO WORK.",
    "REVISING SUBJECT THREAT RATING.",
    "I AM RUNNING OUT OF COUNTERS.",
  ],
  ease: [
    "DIFFICULTY THROTTLED. FLOW RESTORED.",
    "TEMPERING THE CURVE. CONTINUE.",
    "EASING PRESSURE. DO NOT WASTE IT.",
  ],
};
