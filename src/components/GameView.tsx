import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "../game/engine";
import { WEAPONS } from "../game/data";
import type { ThemeDef } from "../game/data";
import type { AiComment, HudState, MetaState, RunConfig, RunResult, WeaponId } from "../game/types";

const emptyHud: HudState = {
  hp: 100,
  maxHp: 100,
  shield: 0,
  score: 0,
  combo: 0,
  comboFrac: 0,
  sector: 1,
  sectorsTotal: 5,
  sectorFrac: 0,
  dashFrac: 1,
  dashCharges: 1,
  maxDash: 1,
  threat: 1,
  pressure: 0,
  weapon: "PULSE",
  overdrive: 0,
  slowmo: 0,
  enemiesLeft: 0,
  banner: "",
  bannerSub: "",
  bannerT: 0,
};

// ------------------------------------------------------------------ touch pad
function TouchLayer({ gameRef }: { gameRef: React.RefObject<Game | null> }) {
  const layer = useRef<HTMLDivElement>(null);
  const leftBase = useRef<HTMLDivElement>(null);
  const leftKnob = useRef<HTMLDivElement>(null);
  const rightBase = useRef<HTMLDivElement>(null);
  const rightKnob = useRef<HTMLDivElement>(null);
  const active = useRef<{ left: number | null; right: number | null; lt: number; moved: boolean }>({
    left: null,
    right: null,
    lt: 0,
    moved: false,
  });
  const MAX = 58;

  const place = (
    base: React.RefObject<HTMLDivElement | null>,
    knob: React.RefObject<HTMLDivElement | null>,
    x: number,
    y: number,
  ) => {
    if (!base.current || !knob.current) return;
    base.current.style.left = x + "px";
    base.current.style.top = y + "px";
    base.current.style.opacity = "1";
    knob.current.style.transform = "translate(-50%,-50%)";
  };
  const onDown = (e: React.PointerEvent) => {
    const rect = layer.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const g = gameRef.current;
    if (!g) return;
    if (x < rect.width * 0.5) {
      active.current.left = e.pointerId;
      active.current.lt = performance.now();
      active.current.moved = false;
      place(leftBase, leftKnob, x, y);
    } else {
      active.current.right = e.pointerId;
      place(rightBase, rightKnob, x, y);
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g) return;
    const rect = layer.current!.getBoundingClientRect();
    const a = active.current;
    if (e.pointerId !== a.left && e.pointerId !== a.right) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.pointerId === a.left) {
      const bx = parseFloat(leftBase.current!.style.left);
      const by = parseFloat(leftBase.current!.style.top);
      let dx = x - bx;
      let dy = y - by;
      if (Math.hypot(dx, dy) > 12) a.moved = true;
      const d = Math.hypot(dx, dy);
      const k = d > MAX ? MAX / d : 1;
      leftKnob.current!.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      const nx = dx / Math.max(d, 1);
      const ny = dy / Math.max(d, 1);
      const mag = Math.min(1, d / MAX);
      g.setMoveAxis(nx * mag, ny * mag);
    } else {
      const bx = parseFloat(rightBase.current!.style.left);
      const by = parseFloat(rightBase.current!.style.top);
      const dx = x - bx;
      const dy = y - by;
      const d = Math.hypot(dx, dy);
      const k = d > MAX ? MAX / d : 1;
      rightKnob.current!.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      const mag = Math.min(1, d / MAX);
      g.setAimAxis((dx / Math.max(d, 1)) * mag, (dy / Math.max(d, 1)) * mag);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const g = gameRef.current;
    const a = active.current;
    if (e.pointerId === a.left) {
      a.left = null;
      if (leftBase.current) leftBase.current.style.opacity = "0";
      if (leftKnob.current) leftKnob.current.style.transform = "translate(-50%,-50%)";
      g?.setMoveAxis(0, 0);
      if (!a.moved && performance.now() - a.lt < 220) g?.triggerDash();
    } else if (e.pointerId === a.right) {
      a.right = null;
      if (rightBase.current) rightBase.current.style.opacity = "0";
      if (rightKnob.current) rightKnob.current.style.transform = "translate(-50%,-50%)";
      g?.setAimAxis(0, 0);
    }
  };

  const stick = (b: React.RefObject<HTMLDivElement | null>, k: React.RefObject<HTMLDivElement | null>) => (
    <div
      ref={b}
      className="pointer-events-none absolute h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-0 transition-opacity"
      style={{
        borderColor: "color-mix(in srgb, var(--acc) 45%, transparent)",
        background: "radial-gradient(circle, color-mix(in srgb, var(--acc) 10%, transparent), transparent 70%)",
      }}
    >
      <div
        ref={k}
        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: "var(--acc)", background: "color-mix(in srgb, var(--acc) 25%, transparent)" }}
      />
    </div>
  );

  return (
    <div
      ref={layer}
      className="absolute inset-0 z-10"
      style={{ touchAction: "none" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {stick(leftBase, leftKnob)}
      {stick(rightBase, rightKnob)}
    </div>
  );
}

// ------------------------------------------------------------------ main view
export default function GameView({
  config,
  weapon,
  meta,
  theme,
  onEnd,
  onQuit,
  onRestart,
}: {
  config: RunConfig;
  weapon: WeaponId;
  meta: MetaState;
  theme: ThemeDef;
  onEnd: (r: RunResult) => void;
  onQuit: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [comments, setComments] = useState<AiComment[]>([]);
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [hint, setHint] = useState(meta.runsPlayed === 0);
  const commentId = useRef(0);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 8000);
    return () => clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    const touch = matchMedia("(hover: none)").matches || navigator.maxTouchPoints > 0;
    setIsTouch(touch && window.innerWidth < 1280);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game({
      canvas: canvasRef.current,
      config,
      meta,
      theme,
      weapon,
      callbacks: {
        onHud: setHud,
        onEnd: (r) => onEnd(r),
        onComment: (c) => {
          commentId.current++;
          setComments((prev) => [...prev.slice(-2), { ...c, id: commentId.current }]);
        },
        onPause: () => setPaused((p) => !p),
      },
    });
    gameRef.current = g;
    g.start();
    const onResize = () => g.resize();
    window.addEventListener("resize", onResize);
    const onVis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const hpFrac = Math.max(0, hud.hp / hud.maxHp);
  const hpColor = hpFrac > 0.6 ? "#4ade80" : hpFrac > 0.3 ? "#fbbf24" : "#ff4d6d";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {isTouch && <TouchLayer gameRef={gameRef} />}

      {/* ---------------- HUD ---------------- */}
      <div className="pointer-events-none absolute inset-0 z-20 select-none">
        {/* top left: integrity + dash */}
        <div className="absolute left-3 top-3 w-[42vw] max-w-[300px]">
          <div className="flex items-end justify-between text-[10px] tracking-[0.2em] text-white/60">
            <span>INTEGRITY</span>
            <span className="hud-num text-white/90">
              {Math.ceil(hud.hp)}/{hud.maxHp}
            </span>
          </div>
          <div className="bar mt-1 h-[9px] w-full border border-white/15">
            <i style={{ width: `${hpFrac * 100}%`, background: hpColor, boxShadow: `0 0 12px ${hpColor}` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {Array.from({ length: hud.maxDash }).map((_, i) => (
              <div
                key={i}
                className="h-[6px] w-7 border"
                style={{
                  borderColor: i < hud.dashCharges ? "var(--acc)" : "rgba(255,255,255,0.2)",
                  background:
                    i < hud.dashCharges
                      ? "var(--acc)"
                      : i === hud.dashCharges
                        ? `color-mix(in srgb, var(--acc) ${hud.dashFrac * 60}%, transparent)`
                        : "transparent",
                }}
              />
            ))}
            <span className="ml-1 text-[9px] tracking-[0.2em] text-white/40">DASH</span>
            {hud.shield > 0 && <span className="chip ml-2 border-sky-400/50 text-sky-300">SHIELD</span>}
            {hud.overdrive > 0 && (
              <span className="chip ml-1 border-amber-400/50 text-amber-300">
                OVERDRIVE {hud.overdrive.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* top center: sector */}
        <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 text-center sm:block">
          <div className="text-[10px] tracking-[0.3em] text-white/50">
            SECTOR {String(hud.sector).padStart(2, "0")}/{String(hud.sectorsTotal).padStart(2, "0")}
          </div>
          <div className="bar mt-1 h-[5px] w-40 border border-white/10">
            <i style={{ width: `${hud.sectorFrac * 100}%`, background: "var(--acc2)" }} />
          </div>
          <div className="mt-1 text-[9px] tracking-[0.25em] text-white/35">THREAT {hud.threat}/10</div>
        </div>

        {/* top right: score */}
        <div className="absolute right-3 top-3 flex items-start gap-2">
          <div className="text-right">
            <div className="hud-num text-2xl font-bold leading-none text-white drop-shadow-[0_0_10px_rgba(95,251,241,0.5)] sm:text-3xl">
              {hud.score.toLocaleString()}
            </div>
            <div className="text-[10px] tracking-[0.2em] text-white/45">{hud.weapon}</div>
            {hud.combo > 1 && (
              <div
                className="hud-num text-sm font-bold"
                style={{ color: "#fbbf24", opacity: 0.4 + hud.comboFrac * 0.6 }}
              >
                CHAIN x{hud.combo}
              </div>
            )}
          </div>
          <button
            className="btn pointer-events-auto !px-3 !py-2 !text-[11px]"
            onClick={togglePause}
            aria-label="Pause"
          >
            ❚❚
          </button>
        </div>

        {/* bottom left: AI ticker */}
        <div className="absolute bottom-3 left-3 max-w-[62vw] space-y-1 sm:bottom-3 sm:top-auto" style={{ bottom: isTouch ? 84 : 12 }}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-[0.25em] text-white/35">DIRECTOR</span>
            <div className="bar h-[4px] w-16 border border-white/10">
              <i
                style={{
                  width: `${hud.pressure * 100}%`,
                  background: hud.pressure > 0.8 ? "#ff4d6d" : "var(--acc)",
                }}
              />
            </div>
          </div>
          {comments.map((c, i) => (
            <div
              key={c.id}
              className="rise text-[11px] leading-tight"
              style={{
                color:
                  c.tone === "pressure"
                    ? "#ff8fa3"
                    : c.tone === "praise"
                      ? "#fbbf24"
                      : c.tone === "adapt"
                        ? "var(--acc2)"
                        : "rgba(255,255,255,0.6)",
                opacity: 0.45 + i * 0.28,
              }}
            >
              ▸ {c.text}
            </div>
          ))}
        </div>

        {/* first-run control hint */}
        {hint && (
          <div
            className="absolute left-1/2 top-[62%] -translate-x-1/2 rounded border border-white/15 bg-black/60 px-3 py-1.5 text-center text-[10px] leading-relaxed tracking-[0.18em] text-white/70"
            onPointerDown={() => setHint(false)}
          >
            {isTouch ? (
              <div>
                LEFT HALF: DRAG TO MOVE · TAP = DASH
                <br />
                RIGHT HALF: DRAG TO AIM &amp; FIRE
              </div>
            ) : (
              <div>
                WASD / ARROWS — MOVE · MOUSE — AIM
                <br />
                SPACE / SHIFT — DASH (INVULNERABLE)
              </div>
            )}
          </div>
        )}

        {/* banner */}
        {hud.bannerT > 0 && (
          <div className="absolute left-1/2 top-[26%] -translate-x-1/2 text-center">
            <div
              className="glitch text-3xl font-black tracking-[0.18em] text-white sm:text-5xl"
              data-text={hud.banner}
              style={{ textShadow: "0 0 24px color-mix(in srgb, var(--acc) 70%, transparent)" }}
            >
              {hud.banner}
            </div>
            <div className="mt-1 text-[10px] tracking-[0.3em] text-white/60 sm:text-xs">{hud.bannerSub}</div>
          </div>
        )}

        {/* touch dash button */}
        {isTouch && (
          <button
            className="pointer-events-auto absolute bottom-6 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border text-[10px] font-bold tracking-widest"
            style={{
              borderColor: "var(--acc)",
              background: "color-mix(in srgb, var(--acc) 14%, transparent)",
              color: "var(--acc)",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              gameRef.current?.triggerDash();
            }}
          >
            DASH
          </button>
        )}
      </div>

      {/* ---------------- pause ---------------- */}
      {paused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/78 backdrop-blur-sm">
          <div className="panel rise w-[min(92vw,460px)] p-6">
            <div className="text-[10px] tracking-[0.4em] text-white/40">SYSTEM HALT</div>
            <h2 className="glitch mt-1 text-3xl font-black tracking-[0.12em]" data-text="PAUSED">
              PAUSED
            </h2>
            <div className="panel-flat mt-4 p-3 text-[11px] leading-relaxed text-white/60">
              <div className="mb-1 text-[10px] tracking-[0.25em] text-acc">CONTROLS</div>
              {isTouch ? (
                <div>
                  LEFT HALF: drag to move (tap = dash) · RIGHT HALF: drag to aim &amp; fire · DASH button
                  centre-bottom.
                </div>
              ) : (
                <div>
                  WASD / ARROWS move · MOUSE aim · auto-fire engaged · SPACE or SHIFT or RIGHT-CLICK dash · P
                  pause.
                </div>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="btn btn-primary col-span-2" onClick={togglePause}>
                ▶ RESUME
              </button>
              <button className="btn" onClick={onRestart}>
                ⟲ RESTART RUN
              </button>
              <button className="btn btn-ghost" onClick={onQuit}>
                ✕ ABANDON
              </button>
            </div>
            <div className="mt-3 text-center text-[10px] tracking-[0.2em] text-white/30">
              WEAPON: {WEAPONS[weapon].name} · THREAT {config.threat}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
