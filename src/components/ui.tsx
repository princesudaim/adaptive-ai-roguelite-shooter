import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel relative", className)}>{children}</div>;
}

export function SectionTitle({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-3">
      {kicker && <div className="text-[10px] tracking-[0.4em] text-white/35">{kicker}</div>}
      <h2 className="text-xl font-black tracking-[0.14em] text-white sm:text-2xl">{title}</h2>
    </div>
  );
}

export function GlitchTitle({ text, className }: { text: string; className?: string }) {
  return (
    <h1
      className={cn("glitch font-black tracking-[0.08em] text-white", className)}
      data-text={text}
      style={{ textShadow: "0 0 30px color-mix(in srgb, var(--acc) 55%, transparent)" }}
    >
      {text}
    </h1>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-flat p-2.5">
      <div className="text-[9px] tracking-[0.22em] text-white/40">{label}</div>
      <div
        className={cn("hud-num text-xl font-bold leading-tight", accent ? "text-acc" : "text-white")}
        style={accent ? { color: "var(--acc)" } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] tracking-[0.15em] text-white/35">{sub}</div>}
    </div>
  );
}

export function Meter({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? "var(--acc)";
  return (
    <div>
      <div className="flex justify-between text-[9px] tracking-[0.18em] text-white/45">
        <span>{label}</span>
        <span className="hud-num">{Math.round(value * 100)}%</span>
      </div>
      <div className="bar mt-0.5 h-[6px] w-full border border-white/10">
        <i style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, background: c }} />
      </div>
    </div>
  );
}

export function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--acc) 12%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--acc) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 20%, transparent 75%)",
        }}
      />
      <div
        className="absolute -left-40 top-[-20%] h-[70vh] w-[70vh] rounded-full blur-[110px] opacity-30"
        style={{ background: "var(--acc)" }}
      />
      <div
        className="absolute -right-32 bottom-[-25%] h-[60vh] w-[60vh] rounded-full blur-[120px] opacity-25"
        style={{ background: "var(--acc2)" }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto pr-1", className)} style={{ scrollbarGutter: "stable" }}>
      {children}
    </div>
  );
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
