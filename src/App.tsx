import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameView from "./components/GameView";
import {
  AutopsyScreen,
  BriefScreen,
  TitleScreen,
  VictoryScreen,
} from "./components/screens";
import { HowToScreen, ScoresScreen, SettingsScreen, UpgradeScreen } from "./components/menus";
import { THEMES, UPGRADES } from "./game/data";
import { buildBrief } from "./game/ai";
import { sfx, setMuted, unlockAudio } from "./game/audio";
import { DEFAULT_META, applyRunResult, loadMeta, saveMeta, upgradeCost } from "./game/storage";
import type { MetaState, RunResult, WeaponId } from "./game/types";

type Screen =
  | "title"
  | "brief"
  | "play"
  | "autopsy"
  | "victory"
  | "shop"
  | "scores"
  | "settings"
  | "howto";

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta());
  const [screen, setScreen] = useState<Screen>("title");
  const [result, setResult] = useState<RunResult | null>(null);
  const [weapon, setWeapon] = useState<WeaponId | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [muteUi, setMuteUi] = useState(false);
  const [prevScreen, setPrevScreen] = useState<Screen>("title");
  const lastTelemetry = useRef<RunResult["telemetry"] | null>(null);

  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  const theme = useMemo(() => THEMES.find((t) => t.id === meta.theme) ?? THEMES[0], [meta.theme]);

  const [briefState, setBriefState] = useState<ReturnType<typeof buildBrief> | null>(null);

  // ------------------------------------------------------------------ flow
  const startNewCampaign = useCallback(() => {
    const b = buildBrief(lastTelemetry.current, meta, { won: false, fresh: true });
    setBriefState(b);
    setWeapon(b.config.weaponOffers[0] ?? "pulse");
    setScreen("brief");
  }, [meta]);

  const handleEnd = useCallback(
    (r: RunResult) => {
      const b = buildBrief(r.telemetry, meta, { won: r.won });
      lastTelemetry.current = r.telemetry;
      setMeta((m) => applyRunResult(m, r, b.config.threat));
      setResult(r);
      setBriefState(b);
      setWeapon(b.config.weaponOffers[0] ?? "pulse");
      setScreen(r.won ? "victory" : "autopsy");
    },
    [meta],
  );

  const launchRun = useCallback(() => {
    if (!briefState || !weapon) return;
    setRunKey((k) => k + 1);
    setScreen("play");
  }, [briefState, weapon]);

  const restartRun = useCallback(() => {
    setRunKey((k) => k + 1);
  }, []);

  // ------------------------------------------------------------------ meta ops
  const buyUpgrade = (id: string) => {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const cost = upgradeCost(meta, id, def.costs);
    if (cost === null || meta.shards < cost) return;
    sfx.pickup();
    setMeta((m) => ({
      ...m,
      shards: m.shards - cost,
      upgrades: { ...m.upgrades, [id]: (m.upgrades[id] ?? 0) + 1 },
    }));
  };

  const toggle = (k: "hardcore" | "autofire" | "screenShake") =>
    setMeta((m) => ({ ...m, [k]: !m[k] }));

  const toggleMute = () => {
    const next = !muteUi;
    setMuteUi(next);
    setMuted(next);
    if (!next) sfx.ui();
  };

  const goFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  const cssVars = {
    "--acc": theme.pal.accent,
    "--acc2": theme.pal.accent === "#c084fc" ? "#5ffbf1" : "#c084fc",
    "--bg0": theme.pal.bg0,
    "--bg1": theme.pal.bg1,
    "--txt": theme.pal.text,
  } as React.CSSProperties;

  const openMenu = (s: Screen) => {
    setPrevScreen(screen === "title" ? "title" : screen);
    setScreen(s);
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={cssVars}
      onPointerDown={() => unlockAudio()}
    >
      {screen === "title" && (
        <TitleScreen
          meta={meta}
          onStart={startNewCampaign}
          onUpgrades={() => openMenu("shop")}
          onScores={() => openMenu("scores")}
          onSettings={() => openMenu("settings")}
          onHowTo={() => openMenu("howto")}
        />
      )}

      {screen === "brief" && briefState && (
        <BriefScreen
          config={briefState.config}
          profile={briefState.profile}
          meta={meta}
          selected={weapon}
          onSelect={setWeapon}
          onStart={launchRun}
          onBack={() => setScreen("title")}
        />
      )}

      {screen === "play" && briefState && weapon && (
        <GameView
          key={runKey}
          config={briefState.config}
          weapon={weapon}
          meta={meta}
          theme={theme}
          onEnd={handleEnd}
          onQuit={() => setScreen("title")}
          onRestart={restartRun}
        />
      )}

      {screen === "autopsy" && result && (
        <AutopsyScreen
          result={result}
          insights={briefState?.insights ?? []}
          profile={briefState?.profile ?? { aggression: 0, mobility: 0, precision: 0, greed: 0, composure: 0, style: "UNKNOWN" }}
          meta={meta}
          onNext={() => setScreen("brief")}
          onUpgrades={() => openMenu("shop")}
        />
      )}

      {screen === "victory" && result && (
        <VictoryScreen
          result={result}
          meta={meta}
          onNext={() => setScreen("brief")}
          onTitle={() => setScreen("title")}
        />
      )}

      {screen === "shop" && (
        <UpgradeScreen meta={meta} onBuy={buyUpgrade} onBack={() => setScreen(prevScreen === "shop" ? "title" : prevScreen)} />
      )}
      {screen === "scores" && <ScoresScreen meta={meta} onBack={() => setScreen(prevScreen === "scores" ? "title" : prevScreen)} />}
      {screen === "howto" && <HowToScreen onBack={() => setScreen("title")} />}
      {screen === "settings" && (
        <SettingsScreen
          meta={meta}
          onToggle={toggle}
          onTheme={(id) => setMeta((m) => ({ ...m, theme: id }))}
          onUnlockTheme={(id) =>
            setMeta((m) => ({ ...m, unlockedThemes: [...new Set([...m.unlockedThemes, id])], theme: id }))
          }
          onWipe={() => {
            setMeta({ ...DEFAULT_META });
            lastTelemetry.current = null;
            setScreen("title");
          }}
          onBack={() => setScreen(prevScreen === "settings" ? "title" : prevScreen)}
          muted={muteUi}
          onMute={toggleMute}
        />
      )}

      {/* global chrome */}
      {screen !== "play" && (
        <button
          className="btn btn-ghost absolute bottom-11 right-3 z-30 !px-2.5 !py-1.5 !text-[10px] sm:bottom-14"
          onClick={goFullscreen}
          title="Fullscreen"
        >
          ⛶
        </button>
      )}

    </div>
  );
}
