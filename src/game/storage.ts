import type { MetaState, RunResult } from "./types";

const KEY = "glitchbreaker.v1";

export const DEFAULT_META: MetaState = {
  shards: 0,
  upgrades: {},
  theme: "cyber",
  unlockedThemes: ["cyber"],
  hardcore: false,
  autofire: true,
  screenShake: true,
  threat: 1,
  defeated: false,
  runsPlayed: 0,
  history: [],
  scores: [],
};

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return {
      ...DEFAULT_META,
      ...parsed,
      upgrades: { ...parsed.upgrades },
      unlockedThemes: parsed.unlockedThemes?.length ? parsed.unlockedThemes : DEFAULT_META.unlockedThemes,
      history: (parsed.history ?? []).slice(-12),
      scores: (parsed.scores ?? []).slice(0, 10),
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(m: MetaState) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...m, history: m.history.slice(-12), scores: m.scores.slice(0, 10) }),
    );
  } catch {
    /* storage unavailable */
  }
}

export function upgradeRank(m: MetaState, id: string) {
  return m.upgrades[id] ?? 0;
}

export function applyRunResult(m: MetaState, result: RunResult, nextThreat?: number): MetaState {
  const next: MetaState = {
    ...m,
    shards: m.shards + result.shards,
    runsPlayed: m.runsPlayed + 1,
    threat: nextThreat ?? (result.won ? Math.min(10, m.threat + 1) : result.threat),
    history: [...m.history, result].slice(-12),
    scores: [
      ...m.scores,
      {
        score: result.score,
        threat: result.threat,
        weapon: result.weapon,
        sector: result.sector,
        date: Date.now(),
      },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
  };
  if (result.noCounter) next.defeated = true;
  return next;
}

export function upgradeCost(m: MetaState, id: string, costs: number[]): number | null {
  const rank = upgradeRank(m, id);
  if (rank >= costs.length) return null;
  return costs[rank];
}
