import { useState } from "react";
import { THEMES, UPGRADES } from "../game/data";
import { sfx } from "../game/audio";
import { upgradeCost, upgradeRank } from "../game/storage";
import type { MetaState } from "../game/types";
import { Backdrop, Panel, ScrollArea, SectionTitle, StatTile } from "./ui";

function Shell({ children, onBack, title, kicker }: { children: React.ReactNode; onBack: () => void; title: string; kicker: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black/40">
      <Backdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col p-3 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionTitle kicker={kicker} title={title} />
          <button className="btn !px-3 !py-2" onClick={onBack}>
            ← BACK
          </button>
        </div>
        <ScrollArea className="mt-2">{children}</ScrollArea>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- upgrades
export function UpgradeScreen({
  meta,
  onBuy,
  onBack,
}: {
  meta: MetaState;
  onBuy: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <Shell onBack={onBack} kicker="PERSISTENT PROGRESSION" title="UPGRADE FABRICATOR">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="DATA SHARDS" value={meta.shards} sub="CURRENCY" accent />
        <StatTile label="RUNS LOGGED" value={meta.runsPlayed} />
        <StatTile label="THREAT LEVEL" value={`${meta.threat}/10`} />
        <StatTile label="AI DEFEATED" value={meta.defeated ? "YES" : "NOT YET"} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const rank = upgradeRank(meta, u.id);
          const cost = upgradeCost(meta, u.id, u.costs);
          const maxed = cost === null;
          const afford = cost !== null && meta.shards >= cost;
          return (
            <Panel key={u.id} className="flex items-start gap-3 p-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center border text-lg"
                style={{ borderColor: "color-mix(in srgb, var(--acc) 40%, transparent)", color: "var(--acc)" }}
              >
                {u.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-bold tracking-[0.1em]">{u.name}</div>
                  <div className="flex gap-0.5">
                    {u.costs.map((_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-3"
                        style={{ background: i < rank ? "var(--acc)" : "rgba(255,255,255,0.15)" }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-white/55">{u.desc}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] tracking-[0.2em] text-white/35">
                    {maxed ? "MAX RANK" : `RANK ${rank} → ${rank + 1}`}
                  </span>
                  <button
                    className="btn !px-3 !py-1.5 !text-[10px]"
                    disabled={maxed || !afford}
                    onClick={() => {
                      sfx.ui();
                      onBuy(u.id);
                    }}
                  >
                    {maxed ? "MAXED" : `◆ ${cost}`}
                  </button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed tracking-[0.15em] text-white/30">
        UPGRADES PERSIST ACROSS RUNS AND ARE VISIBLE TO THE AI DIRECTOR. IT WILL COMPENSATE.
      </p>
    </Shell>
  );
}

// ---------------------------------------------------------------- scores
export function ScoresScreen({ meta, onBack }: { meta: MetaState; onBack: () => void }) {
  const best = meta.scores[0]?.score ?? 0;
  return (
    <Shell onBack={onBack} kicker="LOCAL RECORD ARCHIVE" title="HIGH SCORES">
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile label="BEST SCORE" value={best.toLocaleString()} accent />
        <StatTile label="HIGHEST THREAT" value={Math.max(1, ...meta.scores.map((s) => s.threat))} />
        <StatTile label="TOTAL RUNS" value={meta.runsPlayed} />
      </div>
      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_4rem_4.5rem_3.5rem] gap-2 border-b border-white/10 px-3 py-2 text-[9px] tracking-[0.2em] text-white/40">
          <span>#</span>
          <span>SCORE</span>
          <span>THREAT</span>
          <span>WEAPON</span>
          <span>SECT.</span>
        </div>
        {meta.scores.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] tracking-[0.2em] text-white/30">
            NO RUNS LOGGED. THE AI IS BORED.
          </div>
        )}
        {meta.scores.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[2rem_1fr_4rem_4.5rem_3.5rem] items-center gap-2 border-b border-white/5 px-3 py-2 text-[12px]"
            style={{ background: i === 0 ? "color-mix(in srgb, var(--acc) 8%, transparent)" : undefined }}
          >
            <span className="text-white/40">{i + 1}</span>
            <span className="hud-num font-bold text-white">{s.score.toLocaleString()}</span>
            <span className="text-acc2" style={{ color: "var(--acc2)" }}>
              {s.threat}
            </span>
            <span className="text-white/60">{s.weapon.toUpperCase()}</span>
            <span className="hud-num text-white/60">{s.sector}</span>
          </div>
        ))}
      </Panel>

      {meta.history.length > 0 && (
        <>
          <div className="mt-5 text-[10px] tracking-[0.3em] text-white/35">RECENT RUN HISTORY</div>
          <div className="mt-2 space-y-1">
            {[...meta.history].reverse().slice(0, 8).map((h, i) => (
              <div
                key={i}
                className="panel-flat flex items-center justify-between px-3 py-1.5 text-[10px] tracking-[0.12em]"
              >
                <span style={{ color: h.won ? "#4ade80" : "#ff8fa3" }}>{h.won ? "CLEARED" : "TERMINATED"}</span>
                <span className="text-white/45">{h.killedBy}</span>
                <span className="hud-num text-white/70">{h.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- settings + themes
export function SettingsScreen({
  meta,
  onToggle,
  onTheme,
  onUnlockTheme,
  onWipe,
  onBack,
  muted,
  onMute,
}: {
  meta: MetaState;
  onToggle: (k: "hardcore" | "autofire" | "screenShake") => void;
  onTheme: (id: string) => void;
  onUnlockTheme: (id: string) => void;
  onWipe: () => void;
  onBack: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const toggles: { key: "hardcore" | "autofire" | "screenShake"; name: string; desc: string }[] = [
    {
      key: "autofire",
      name: "AUTO-FIRE",
      desc: "Weapon discharges continuously at your aim vector. Recommended for touch.",
    },
    { key: "screenShake", name: "SCREEN SHAKE", desc: "Impact feedback. Disable for comfort." },
    {
      key: "hardcore",
      name: "HARDCORE MODE",
      desc: "AI flow-state tuning disabled. It will not ease off when you are losing. +60% shards.",
    },
  ];
  return (
    <Shell onBack={onBack} kicker="OPERATOR CONFIGURATION" title="SETTINGS & THEMES">
      <div className="grid gap-2">
        {toggles.map((t) => (
          <button
            key={t.key}
            className="panel-flat flex items-center justify-between gap-3 p-3 text-left transition-colors hover:border-white/25"
            onClick={() => {
              sfx.ui();
              onToggle(t.key);
            }}
          >
            <span>
              <span className="block text-[12px] font-bold tracking-[0.14em]">{t.name}</span>
              <span className="block text-[10px] leading-snug text-white/45">{t.desc}</span>
            </span>
            <span
              className="flex h-6 w-11 shrink-0 items-center border p-0.5"
              style={{ borderColor: meta[t.key] ? "var(--acc)" : "rgba(255,255,255,0.2)" }}
            >
              <span
                className="h-full w-5 transition-transform"
                style={{
                  transform: meta[t.key] ? "translateX(20px)" : "none",
                  background: meta[t.key] ? "var(--acc)" : "rgba(255,255,255,0.3)",
                }}
              />
            </span>
          </button>
        ))}
        <button
          className="panel-flat flex items-center justify-between gap-3 p-3 text-left"
          onClick={() => {
            onMute();
          }}
        >
          <span>
            <span className="block text-[12px] font-bold tracking-[0.14em]">AUDIO</span>
            <span className="block text-[10px] text-white/45">Synthesised combat feedback.</span>
          </span>
          <span className="text-[11px] tracking-[0.2em]" style={{ color: muted ? "#ff8fa3" : "var(--acc)" }}>
            {muted ? "MUTED" : "ON"}
          </span>
        </button>
      </div>

      <div className="mt-6 text-[10px] tracking-[0.3em] text-white/35">AI THEME STORE</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {THEMES.map((t) => {
          const owned = meta.unlockedThemes.includes(t.id);
          const active = meta.theme === t.id;
          return (
            <Panel key={t.id} className={active ? "p-3 ring-1 ring-white/20" : "p-3"}>
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold tracking-[0.12em]">{t.name}</div>
                {active && <span className="chip">ACTIVE</span>}
              </div>
              <div className="mt-2 flex gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="h-6 flex-1 border border-white/10" style={{ background: c }} />
                ))}
              </div>
              <div className="mt-2 text-[10px] leading-snug text-white/45">{t.desc}</div>
              <button
                className="btn mt-3 w-full !py-1.5 !text-[10px]"
                disabled={active}
                onClick={() => {
                  sfx.ui();
                  if (owned) onTheme(t.id);
                  else onUnlockTheme(t.id);
                }}
              >
                {active ? "EQUIPPED" : owned ? "EQUIP" : "◆ UNLOCK (DEMO)"}
              </button>
            </Panel>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] tracking-[0.15em] text-white/25">
        THEMES ARE COSMETIC. THE AI DOES NOT CARE WHAT COLOUR IT KILLS YOU IN.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="text-[10px] leading-snug text-white/40">
          WIPE ARCHIVE — deletes all shards, upgrades, scores and AI memory.
        </div>
        <button
          className="btn !border-red-400/50 !text-[10px] hover:!bg-red-500/15"
          onClick={() => (confirm ? onWipe() : setConfirm(true))}
        >
          {confirm ? "TAP AGAIN TO CONFIRM" : "WIPE"}
        </button>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- how to play
export function HowToScreen({ onBack }: { onBack: () => void }) {
  return (
    <Shell onBack={onBack} kicker="OPERATOR MANUAL" title="HOW TO SURVIVE">
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="p-4">
          <div className="text-[10px] tracking-[0.3em] text-acc" style={{ color: "var(--acc)" }}>
            DESKTOP
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-white/65">
            <li>
              <b className="text-white">WASD / ARROWS</b> — thrust
            </li>
            <li>
              <b className="text-white">MOUSE</b> — aim vector (auto-aim until you move the mouse)
            </li>
            <li>
              <b className="text-white">SPACE / SHIFT / RIGHT-CLICK</b> — dash (invulnerable frames)
            </li>
            <li>
              <b className="text-white">P / ESC</b> — pause
            </li>
            <li>Fire is automatic. Focus on not dying.</li>
          </ul>
        </Panel>
        <Panel className="p-4">
          <div className="text-[10px] tracking-[0.3em]" style={{ color: "var(--acc)" }}>
            TOUCH
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-white/65">
            <li>
              <b className="text-white">LEFT HALF</b> — drag anywhere to move. Quick tap = dash.
            </li>
            <li>
              <b className="text-white">RIGHT HALF</b> — drag to aim (and fire).
            </li>
            <li>
              <b className="text-white">DASH</b> — big button, bottom-centre.
            </li>
          </ul>
        </Panel>
        <Panel className="p-4 sm:col-span-2">
          <div className="text-[10px] tracking-[0.3em]" style={{ color: "var(--acc2)" }}>
            THE DIRECTOR
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/65">
            Every run is monitored: which side you dodge toward, how accurate you are, whether you collect
            salvage, whether you hoard your dash, how long you hug walls. When you die, that telemetry becomes
            an <b className="text-white">Autopsy Report</b> and then a <b className="text-white">Challenge Brief</b>{" "}
            — the next run is deliberately built against your habits. Beat a run at THREAT 8 or higher and the
            Director will admit it has <b className="text-white">NO COUNTER LEFT</b>.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["RUSHER", "#ff4d6d", "Melee pressure"],
              ["SPITTER", "#a78bfa", "Ranged fire"],
              ["ORBITER", "#fbbf24", "Circling bursts"],
              ["LANCER", "#fb923c", "Telegraphed dash"],
              ["SPLITTER", "#34d399", "Divides on death"],
              ["BASTION", "#94a3b8", "Radial bullet rings"],
              ["WRAITH", "#f8fafc", "Blinks behind you"],
              ["MITES", "#4ade80", "Fast swarm bodies"],
            ].map(([n, c, d]) => (
              <div key={n} className="panel-flat flex items-center gap-2 p-2">
                <span className="h-3 w-3 rotate-45" style={{ background: c }} />
                <span className="text-[9px] leading-tight">
                  <b className="text-white/90">{n}</b>
                  <br />
                  <span className="text-white/40">{d}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
