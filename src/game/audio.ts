let ctx: AudioContext | null = null;
let muted = false;
export const setMuted = (m: boolean) => { muted = m; };

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(dur: number, vol = 0.3) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const s = ctx.createBufferSource();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 900;
  s.buffer = buf; g.gain.value = vol;
  s.connect(f).connect(g).connect(ctx.destination);
  s.start();
}

export const sfx = {
  coin: () => { tone(988, 0.08, "square", 0.06); setTimeout(() => tone(1319, 0.12, "square", 0.06), 60); },
  near: (combo: number) => tone(400 + combo * 70, 0.12, "triangle", 0.12, 300),
  power: () => tone(300, 0.35, "sawtooth", 0.08, 900),
  shield: () => { noise(0.2, 0.2); tone(600, 0.3, "triangle", 0.12, -400); },
  crash: () => { noise(0.7, 0.45); tone(160, 0.6, "sawtooth", 0.15, -120); },
  level: () => { tone(523, 0.1, "square", 0.06); setTimeout(() => tone(784, 0.15, "square", 0.06), 90); },
  click: () => tone(700, 0.05, "square", 0.05),
};
