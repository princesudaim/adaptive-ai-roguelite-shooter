let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastPlay: Record<string, number> = {};

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function setMuted(v: boolean) {
  muted = v;
  if (master) master.gain.value = v ? 0 : 0.32;
}

export function isMuted() {
  return muted;
}

type Wave = OscillatorType;

function tone(
  freq: number,
  dur: number,
  type: Wave,
  vol: number,
  opts: { sweep?: number; delay?: number; q?: number } = {},
) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.sweep), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, freq = 900, delay = 0) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

function throttled(key: string, ms: number) {
  const now = performance.now();
  if (lastPlay[key] && now - lastPlay[key] < ms) return false;
  lastPlay[key] = now;
  return true;
}

export const sfx = {
  shoot(weapon: string) {
    if (!throttled("shoot" + weapon, 22)) return;
    switch (weapon) {
      case "scatter":
        noise(0.13, 0.28, 1500);
        tone(180, 0.12, "square", 0.1, { sweep: 60 });
        break;
      case "rail":
        tone(1200, 0.16, "sawtooth", 0.12, { sweep: 220 });
        noise(0.1, 0.14, 2600);
        break;
      case "arc":
        tone(1500, 0.05, "square", 0.05, { sweep: 2200 });
        break;
      case "nova":
        tone(320, 0.18, "sine", 0.14, { sweep: 90 });
        break;
      default:
        tone(820, 0.07, "square", 0.07, { sweep: 320 });
    }
  },
  hit() {
    if (!throttled("hit", 18)) return;
    noise(0.05, 0.13, 2100);
  },
  kill() {
    if (!throttled("kill", 26)) return;
    noise(0.16, 0.2, 700);
    tone(420, 0.16, "triangle", 0.11, { sweep: 120 });
  },
  bigKill() {
    noise(0.3, 0.26, 320);
    tone(160, 0.32, "sawtooth", 0.14, { sweep: 50 });
  },
  dash() {
    noise(0.18, 0.16, 1600);
    tone(700, 0.16, "sine", 0.07, { sweep: 1800 });
  },
  hurt() {
    tone(240, 0.22, "sawtooth", 0.16, { sweep: 70 });
    noise(0.16, 0.16, 380);
  },
  pickup() {
    tone(760, 0.09, "triangle", 0.1);
    tone(1180, 0.1, "triangle", 0.09, { delay: 0.06 });
  },
  combo(n: number) {
    tone(500 + Math.min(12, n) * 60, 0.09, "square", 0.06);
  },
  sector() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0.1, { delay: i * 0.08 }));
  },
  death() {
    [400, 300, 220, 140].forEach((f, i) => tone(f, 0.4, "sawtooth", 0.13, { delay: i * 0.1, sweep: f * 0.4 }));
    noise(0.7, 0.2, 260);
  },
  win() {
    [523, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, "triangle", 0.12, { delay: i * 0.12 }));
  },
  ui() {
    tone(880, 0.05, "square", 0.05);
  },
  ai() {
    tone(180, 0.14, "square", 0.06, { sweep: 520 });
  },
};
