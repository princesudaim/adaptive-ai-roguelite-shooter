import { WEAPONS } from "../game/data";
import { sfx } from "../game/audio";
import type { Insight, PlayerProfile } from "../game/ai";
import type { HudState, MetaState, RunConfig, RunResult, WeaponId } from "../game/types";
import { Backdrop, GlitchTitle, Meter, Panel, ScrollArea, StatTile, fmtTime } from "./ui";

const TAUNTS = [
  "I HAVE ALREADY SIMULATED YOUR NEXT THREE DEATHS.",
  "YOUR DODGE BIAS IS NOT A SECRET.",
  "EVERY RUN YOU SURVIVE TEACHES ME SOMETHING WORSE.",
  "FLOW STATE IS A CAGE I BUILT FOR YOU.",
  "THE SALVAGE YOU IGNORED WAS BAIT. YOU DID NOT EVEN TAKE THE BAIT.",
  "I AM NOT RANDOM. I AM SPECIFIC.",
  "ADAPT OR BECOME TRAINING DATA.",
];

// ---------------------------------------------------------------- title
export function TitleScreen({
  meta,
  onStart,
  onUpgrades,
  onScores,
  onSettings,
  onHowTo,
}: {
  meta: MetaState;
  onStart: () => void;
  onUpgrades: () => void;
  onScores: () => void;
  onSettings: () => void;
  onHowTo: () => void;
}) {
  const best = meta.scores[0]?.score ?? 0;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-4 py-6">
        <div className="rise flex flex-col items-center text-center">
          <div className="chip mb-3 flicker">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--acc)" }} />
            ADAPTIVE OPPONENT · ONLINE
          </div>
          <GlitchTitle text="GLITCH BREAKER" className="text-[13vw] leading-[0.9] sm:text-6xl md:text-7xl" />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] tracking-[0.35em] text-white/50 sm:text-xs">
            <span>DIE</span>
            <span style={{ color: "var(--acc)" }}>›</span>
            <span>LEARN</span>
            <span style={{ color: "var(--acc)" }}>›</span>
            <span>ADAPT</span>
          </div>
          <p className="mt-4 max-w-xl text-[11px] leading-relaxed tracking-[0.06em] text-white/55 sm:text-[13px]">
            A roguelite arcade shooter where the enemy patterns, weapon rules and arena itself are rebuilt after
            every death — <span className="text-white">specifically to break the way you play.</span>
          </p>
        </div>

        <div className="rise mt-7 grid w-full max-w-md gap-2">
          <button
            className="btn btn-primary !py-4 !text-sm"
            onClick={() => {
              sfx.ui();
              onStart();
            }}
          >
            ▶ BEGIN RUN {meta.runsPlayed === 0 ? "" : `· THREAT ${meta.threat}`}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn"
              onClick={() => {
                sfx.ui();
                onUpgrades();
              }}
            >
              ⬆ UPGRADES · ◆{meta.shards}
            </button>
            <button
              className="btn"
              onClick={() => {
                sfx.ui();
                onScores();
              }}
            >
              ★ SCORES
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.ui();
                onHowTo();
              }}
            >
              ? MANUAL
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sfx.ui();
                onSettings();
              }}
            >
              ⚙ SETTINGS
            </button>
          </div>
        </div>

        <div className="mt-5 hidden text-[10px] tracking-[0.3em] text-white/40 portrait:block">
          ↻ ROTATE TO LANDSCAPE FOR A WIDER ARENA
        </div>

        <div className="rise mt-7 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="RUNS" value={meta.runsPlayed} />
          <StatTile label="BEST" value={best.toLocaleString()} />
          <StatTile label="THREAT" value={`${meta.threat}/10`} accent />
          <StatTile label="AI STATUS" value={meta.defeated ? "CONCEDED" : "HUNTING"} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden border-t border-white/10 bg-black/60 py-2">
        <div className="marquee-track text-[10px] tracking-[0.3em] text-white/35">
          {[...TAUNTS, ...TAUNTS].map((t, i) => (
            <span key={i} className="mx-6 whitespace-nowrap">
              ‹ DIRECTOR › {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- brief
export function BriefScreen({
  config,
  profile,
  meta,
  selected,
  onSelect,
  onStart,
  onBack,
}: {
  config: RunConfig;
  profile: PlayerProfile;
  meta: MetaState;
  selected: WeaponId | null;
  onSelect: (w: WeaponId) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const tagColor: Record<string, string> = {
    target: "#ff4d6d",
    pressure: "#fbbf24",
    novelty: "#c084fc",
    denial: "#60a5fa",
  };
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col p-3 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[0.4em] text-white/35">
              DIRECTOR TRANSMISSION · RUN #{meta.runsPlayed + 1}
            </div>
            <h2 className="glitch text-2xl font-black tracking-[0.14em] sm:text-4xl" data-text="CHALLENGE BRIEF">
              CHALLENGE BRIEF
            </h2>
          </div>
          <button className="btn btn-ghost !px-3 !py-2 !text-[10px]" onClick={onBack}>
            ← TITLE
          </button>
        </div>

        <ScrollArea className="mt-4">
          <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
            {/* directives */}
            <div className="space-y-2">
              <Panel className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] tracking-[0.3em] text-white/40">THREAT ESCALATION</div>
                    <div className="flex items-center gap-2">
                      <span className="hud-num text-2xl font-black" style={{ color: "var(--acc)" }}>
                        {config.threat}
                      </span>
                      <span className="text-[10px] text-white/40">/ 10</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] tracking-[0.3em] text-white/40">AI CONFIDENCE</div>
                    <div className="hud-num text-2xl font-black" style={{ color: "var(--acc2)" }}>
                      {config.aiConfidence}%
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2 flex-1"
                      style={{
                        background:
                          i < config.threat
                            ? i > 6
                              ? "#ff4d6d"
                              : i > 3
                                ? "#fbbf24"
                                : "var(--acc)"
                            : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2 text-[10px] leading-snug tracking-[0.08em] text-white/50">
                  OBJECTIVE: {config.objective} · {config.sectors} SECTORS ·{" "}
                  {config.hardcore ? "HARDCORE FLOW-TUNING OFF" : "FLOW-TUNING ACTIVE"}
                </div>
                <div className="mt-2 border-t border-white/10 pt-2 text-[10px] tracking-[0.1em] text-white/45">
                  SUBJECT CLASSIFICATION: <span style={{ color: "var(--acc)" }}>{profile.style}</span>
                </div>
              </Panel>

              {config.directives.map((d) => (
                <div key={d.id} className="panel rise flex gap-3 p-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center border text-base"
                    style={{ borderColor: tagColor[d.tag], color: tagColor[d.tag] }}
                  >
                    {d.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold tracking-[0.1em] text-white">{d.title}</span>
                      <span
                        className="chip !py-0 !text-[8px]"
                        style={{ borderColor: `${tagColor[d.tag]}66`, color: tagColor[d.tag] }}
                      >
                        {d.tag.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/55">{d.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* weapons */}
            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.3em] text-white/35">LOADOUT AUTHORISATION</div>
              {(["pulse", "scatter", "rail", "arc", "nova"] as WeaponId[])
                .filter((w) => config.weaponOffers.includes(w) || w === config.bannedWeapon)
                .map((w) => {
                  const def = WEAPONS[w];
                  const banned = config.bannedWeapon === w;
                  const isSel = selected === w;
                  return (
                    <button
                      key={w}
                      disabled={banned}
                      onClick={() => {
                        sfx.ui();
                        onSelect(w);
                      }}
                      className="panel w-full p-3 text-left transition-all"
                      style={{
                        borderColor: banned
                          ? "rgba(255,77,109,0.45)"
                          : isSel
                            ? "var(--acc)"
                            : "color-mix(in srgb, var(--acc) 20%, transparent)",
                        opacity: banned ? 0.45 : 1,
                        transform: isSel ? "translateX(4px)" : "none",
                        boxShadow: isSel ? "0 0 26px -6px var(--acc)" : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg" style={{ color: def.color }}>
                            {def.glyph}
                          </span>
                          <span className="text-[13px] font-bold tracking-[0.12em]">{def.name}</span>
                        </div>
                        {banned ? (
                          <span className="chip !border-red-400/50 !text-[8px] !text-red-300">⊘ LOCKED BY AI</span>
                        ) : isSel ? (
                          <span className="chip !text-[8px]">SELECTED</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-white/55">{def.blurb}</p>
                      <div className="mt-2 flex gap-3 text-[9px] tracking-[0.15em] text-white/40">
                        <span>DMG {def.dmg}</span>
                        <span>ROF {(1 / def.cd).toFixed(1)}/s</span>
                        <span>SHOTS {def.count}</span>
                        {def.pierce > 0 && <span>PIERCE {def.pierce}</span>}
                      </div>
                    </button>
                  );
                })}
              <Panel className="p-3">
                <div className="text-[9px] tracking-[0.3em] text-white/40">ENVIRONMENT</div>
                <div className="mt-1 text-[12px] font-bold tracking-[0.1em]" style={{ color: "var(--acc2)" }}>
                  {config.hazard === "none" ? "STANDARD ARENA" : config.hazard.toUpperCase()}
                </div>
                <div className="mt-1 text-[10px] leading-snug text-white/50">
                  {config.hazard === "none"
                    ? "No environmental interference this run."
                    : "Arena rules modified — see directives."}
                </div>
              </Panel>
            </div>
          </div>
        </ScrollArea>

        <div className="mt-3 shrink-0">
          <button
            className="btn btn-primary w-full !py-4 !text-sm"
            disabled={!selected}
            onClick={() => {
              sfx.ui();
              onStart();
            }}
          >
            {selected ? `▶ ACCEPT BRIEF — DEPLOY WITH ${WEAPONS[selected].name}` : "SELECT A LOADOUT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- autopsy
export function AutopsyScreen({
  result,
  insights,
  profile,
  meta,
  onNext,
  onUpgrades,
}: {
  result: RunResult;
  insights: Insight[];
  profile: PlayerProfile;
  meta: MetaState;
  onNext: () => void;
  onUpgrades: () => void;
}) {
  const t = result.telemetry;
  const acc = t.shotsFired ? t.shotsHit / t.shotsFired : 0;
  const sev = (s: string) => (s === "high" ? "#ff4d6d" : s === "med" ? "#fbbf24" : "#60a5fa");
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col p-3 sm:p-6">
        <div className="rise">
          <div className="text-[10px] tracking-[0.4em] text-white/35">
            POST-RUN ANALYSIS · RUN #{meta.runsPlayed}
          </div>
          <h2 className="glitch text-2xl font-black tracking-[0.14em] sm:text-4xl" data-text="AI AUTOPSY">
            AI AUTOPSY
          </h2>
        </div>
        <ScrollArea className="mt-3">
          <Panel className="p-3">
            <div className="text-[10px] tracking-[0.3em]" style={{ color: "#ff8fa3" }}>
              CAUSE OF TERMINATION
            </div>
            <div className="mt-1 text-[14px] font-bold tracking-[0.08em] text-white sm:text-base">
              {result.causeOfDeath}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="SCORE" value={result.score.toLocaleString()} accent />
              <StatTile label="TIME" value={fmtTime(result.timeAlive)} />
              <StatTile label="SECTOR" value={`${result.sector}/${result.sectorsTotal}`} />
              <StatTile label="KILLS" value={result.kills} />
              <StatTile label="PEAK CHAIN" value={`x${result.peakCombo}`} />
              <StatTile label="SHARDS" value={`+${result.shards}`} sub={`◆${meta.shards} BANKED`} />
            </div>
          </Panel>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <Panel className="p-3">
              <div className="text-[10px] tracking-[0.3em] text-white/40">SUBJECT PROFILE</div>
              <div className="mt-1 text-[13px] font-bold tracking-[0.1em]" style={{ color: "var(--acc)" }}>
                {profile.style}
              </div>
              <div className="mt-3 space-y-2.5">
                <Meter label="PRECISION" value={acc} />
                <Meter label="MOBILITY" value={profile.mobility} />
                <Meter label="AGGRESSION" value={profile.aggression} color="#ff4d6d" />
                <Meter label="SALVAGE GREED" value={profile.greed} color="#fbbf24" />
                <Meter label="COMPOSURE" value={profile.composure} color="#c084fc" />
              </div>
              <div className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-white/45">
                <div className="mb-1 tracking-[0.25em] text-white/30">DAMAGE INGRESS</div>
                {Object.entries(t.damageBySource).length === 0 && <div>NO DAMAGE RECORDED.</div>}
                {Object.entries(t.damageBySource)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="hud-num">{Math.round(v)}</span>
                    </div>
                  ))}
              </div>
            </Panel>

            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.3em] text-white/35">
                EXPLOITABLE PATTERNS DETECTED ({insights.length})
              </div>
              {insights.length === 0 && (
                <Panel className="p-3 text-[11px] leading-snug text-white/50">
                  NO EXPLOITABLE PATTERN FOUND. YOU DIED TO STATISTICAL PRESSURE ALONE. THE DIRECTOR FINDS THIS
                  IRRITATING.
                </Panel>
              )}
              {insights.map((i) => (
                <div key={i.id} className="panel rise flex gap-3 p-3">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className="h-2 w-2 rotate-45"
                      style={{ background: sev(i.severity), boxShadow: `0 0 10px ${sev(i.severity)}` }}
                    />
                    <span
                      className="text-[8px] tracking-[0.15em]"
                      style={{ color: sev(i.severity), writingMode: "vertical-rl" }}
                    >
                      {i.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold tracking-[0.1em] text-white">{i.label}</span>
                      <span className="chip !py-0 !text-[8px]" style={{ borderColor: `${sev(i.severity)}66`, color: sev(i.severity) }}>
                        {i.chip}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/55">{i.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Panel className="mt-3 p-3">
            <div className="text-[10px] tracking-[0.3em] text-white/40">DIRECTOR NOTES</div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/60">
              <li>
                ▸ Run terminated after {fmtTime(result.timeAlive)} in sector {result.sector}. {result.kills} chassis
                destroyed, {Math.round(t.damageTaken)} damage absorbed, accuracy{" "}
                {Math.round(acc * 100)}%.
              </li>
              <li>
                ▸ Closest recorded miss: {t.closestCall < 999 ? `${t.closestCall.toFixed(0)}px` : "n/a"} ·{" "}
                {t.nearMisses} near misses · {t.dashesUsed} dashes burned · {t.hitsWhileDashReady} hits taken with
                dash available.
              </li>
              <li>
                ▸ Salvage uptake {t.pickupsSpawned ? Math.round((t.pickupsTaken / t.pickupsSpawned) * 100) : 0}% ·
                mobility {Math.round(profile.mobility * 100)}% · aggression {Math.round(profile.aggression * 100)}%.
              </li>
              <li style={{ color: "var(--acc)" }}>
                ▸ Compiling next Challenge Brief against the above. Adapt, or repeat.
              </li>
            </ul>
          </Panel>
        </ScrollArea>

        <div className="mt-3 grid shrink-0 grid-cols-[1fr_auto] gap-2">
          <button
            className="btn btn-primary !py-4 !text-sm"
            onClick={() => {
              sfx.ui();
              onNext();
            }}
          >
            ▶ GENERATE CHALLENGE BRIEF
          </button>
          <button className="btn !py-4" onClick={onUpgrades}>
            ⬆ UPGRADES ◆{meta.shards}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- victory
export function VictoryScreen({
  result,
  meta,
  onNext,
  onTitle,
}: {
  result: RunResult;
  meta: MetaState;
  onNext: () => void;
  onTitle: () => void;
}) {
  const noCounter = result.noCounter;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Backdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="rise">
          {noCounter ? (
            <>
              <div className="chip mb-3 !border-red-400/60 !text-red-300">DIRECTOR EXCEPTION</div>
              <GlitchTitle text="NO COUNTER LEFT" className="text-[10vw] leading-none sm:text-6xl" />
              <p className="mt-4 text-[12px] leading-relaxed text-white/65 sm:text-sm">
                “You cleared a run at THREAT {result.threat} while I was aiming every system I have at your
                habits. My counter-library is exhausted. I concede this session — and I have already begun building
                a new one.”
              </p>
            </>
          ) : (
            <>
              <div className="chip mb-3">SECTOR OBJECTIVE COMPLETE</div>
              <GlitchTitle text="RUN SURVIVED" className="text-[10vw] leading-none sm:text-6xl" />
              <p className="mt-4 text-[12px] leading-relaxed text-white/65 sm:text-sm">
                All {result.sectorsTotal} sectors cleared at THREAT {result.threat}. The Director logs the failure,
                raises the threat level, and starts designing the counter-run.{" "}
                {result.threat >= 7
                  ? "One more and it runs out of counters."
                  : `THREAT ${Math.min(10, result.threat + 1)} is next.`}
              </p>
            </>
          )}
        </div>

        <div className="rise mt-7 grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="SCORE" value={result.score.toLocaleString()} accent />
          <StatTile label="TIME" value={fmtTime(result.timeAlive)} />
          <StatTile label="KILLS" value={result.kills} />
          <StatTile label="SHARDS" value={`+${result.shards}`} sub={`◆${meta.shards}`} />
        </div>

        <div className="rise mt-7 grid w-full max-w-md gap-2">
          <button
            className="btn btn-primary !py-4 !text-sm"
            onClick={() => {
              sfx.ui();
              onNext();
            }}
          >
            ▶ NEXT CHALLENGE BRIEF
          </button>
          <button className="btn btn-ghost" onClick={onTitle}>
            ← TITLE
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- helper
export function hudEmpty(h: HudState) {
  return h;
}
