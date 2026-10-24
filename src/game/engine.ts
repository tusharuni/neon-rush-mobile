import { sfx } from "./audio";
import type { RunStats } from "./storage";

export interface Look { trail: string; core: string; glow: string; ship: string }
export interface Hud { score: number; combo: number; comboPct: number; coins: number; level: number; shield: boolean; magnet: number; slow: number }

interface Rock { x: number; y: number; r: number; vy: number; vx: number; rot: number; vr: number; verts: number[]; near: boolean; hue: string }
interface Coin { x: number; y: number; vy: number; t: number }
interface Power { x: number; y: number; vy: number; kind: "shield" | "magnet" | "slow"; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Popup { x: number; y: number; text: string; life: number; color: string }
interface Star { x: number; y: number; z: number }

const POWER_COLORS = { shield: "#22e6ff", magnet: "#ffb52e", slow: "#ff3df2" };
const ROCK_HUES = ["#ff3df2", "#ffb52e", "#b47cff", "#ff5b7a"];

export class Game {
  private ctx: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private raf = 0; private last = 0;
  running = false; paused = false;
  private px = 0; private py = 0; private pr = 14; private tx = 0; private ty = 0;
  private trail: { x: number; y: number }[] = [];
  private rocks: Rock[] = []; private coins: Coin[] = []; private powers: Power[] = [];
  private parts: Particle[] = []; private pops: Popup[] = []; private stars: Star[] = [];
  private time = 0; private score = 0; private combo = 1; private comboT = 0; private maxCombo = 1;
  private coinCount = 0; private nearMisses = 0; private level = 1;
  private shield = false; private magnet = 0; private slow = 0;
  private spawnT = 0; private coinT = 0; private powerT = 5;
  private shake = 0; private dead = false; private deadT = 0; private hue = 0;
  private keys = new Set<string>();
  private drag: { sx: number; sy: number; ox: number; oy: number } | null = null;
  private hudT = 0;

  constructor(private canvas: HTMLCanvasElement, public look: Look,
    private onHud: (h: Hud) => void, private onOver: (s: RunStats) => void) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * this.w, y: Math.random() * this.h, z: Math.random() * 0.9 + 0.1 });
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    canvas.addEventListener("pointerdown", this.pd);
    window.addEventListener("pointermove", this.pm);
    window.addEventListener("pointerup", this.pu);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    this.canvas.removeEventListener("pointerdown", this.pd);
    window.removeEventListener("pointermove", this.pm);
    window.removeEventListener("pointerup", this.pu);
  }

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr; this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + "px"; this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.running) { this.px = this.tx = this.w / 2; this.py = this.ty = this.h * 0.78; }
  };
  private kd = (e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow")) e.preventDefault(); };
  private ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private pd = (e: PointerEvent) => { this.drag = { sx: e.clientX, sy: e.clientY, ox: this.tx, oy: this.ty }; };
  private pm = (e: PointerEvent) => {
    if (!this.drag || !this.running || this.paused) return;
    this.tx = this.drag.ox + (e.clientX - this.drag.sx) * 1.25;
    this.ty = this.drag.oy + (e.clientY - this.drag.sy) * 1.25;
  };
  private pu = () => { this.drag = null; };

  start() {
    this.rocks = []; this.coins = []; this.powers = []; this.parts = []; this.pops = []; this.trail = [];
    this.time = 0; this.score = 0; this.combo = 1; this.comboT = 0; this.maxCombo = 1;
    this.coinCount = 0; this.nearMisses = 0; this.level = 1;
    this.shield = false; this.magnet = 0; this.slow = 0;
    this.spawnT = 0.5; this.coinT = 1; this.powerT = 6; this.dead = false; this.deadT = 0;
    this.px = this.tx = this.w / 2; this.py = this.ty = this.h * 0.78;
    this.running = true; this.paused = false;
    this.last = performance.now();
  }

  setPaused(p: boolean) { this.paused = p; this.last = performance.now(); this.drag = null; }

  private loop = (now: number) => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private burst(x: number, y: number, n: number, color: string, speed = 220, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
      const max = 0.4 + Math.random() * 0.6;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: max, max, color, size: size * (0.5 + Math.random()) });
    }
  }
  private pop(x: number, y: number, text: string, color: string) { this.pops.push({ x, y, text, color, life: 1 }); }

  private spawnRock() {
    const r = 14 + Math.random() * (18 + Math.min(this.level, 8) * 2);
    const verts: number[] = [];
    for (let i = 0; i < 9; i++) verts.push(0.75 + Math.random() * 0.35);
    const base = 140 + this.level * 38;
    this.rocks.push({
      x: r + Math.random() * (this.w - r * 2), y: -r - 10, r,
      vy: base * (0.8 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 40 * Math.min(this.level, 5),
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, verts, near: false,
      hue: ROCK_HUES[Math.floor(Math.random() * ROCK_HUES.length)]!,
    });
  }

  private update(dt: number) {
    this.hue = (this.hue + dt * 120) % 360;
    for (const s of this.stars) {
      s.y += (40 + this.level * 25) * s.z * dt * (this.slow > 0 ? 0.35 : 1);
      if (s.y > this.h) { s.y = 0; s.x = Math.random() * this.w; }
    }
    this.shake = Math.max(0, this.shake - dt * 30);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) { p.y -= 50 * dt; p.life -= dt * 1.2; }
    this.pops = this.pops.filter((p) => p.life > 0);

    if (!this.running) return;
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 0.9) {
        this.running = false;
        this.onOver({ time: this.time, coins: this.coinCount, maxCombo: this.maxCombo, score: Math.floor(this.score), nearMisses: this.nearMisses });
      }
      return;
    }

    this.time += dt;
    const lvl = 1 + Math.floor(this.time / 10);
    if (lvl > this.level) { this.level = lvl; sfx.level(); this.pop(this.w / 2, this.h * 0.35, `SPEED ${lvl}`, "#ffb52e"); }
    const tScale = this.slow > 0 ? 0.35 : 1;
    this.magnet = Math.max(0, this.magnet - dt);
    this.slow = Math.max(0, this.slow - dt);

    // input
    const k = this.keys, sp = 520 * dt;
    if (k.has("arrowleft") || k.has("a")) this.tx -= sp;
    if (k.has("arrowright") || k.has("d")) this.tx += sp;
    if (k.has("arrowup") || k.has("w")) this.ty -= sp;
    if (k.has("arrowdown") || k.has("s")) this.ty += sp;
    this.tx = Math.max(this.pr, Math.min(this.w - this.pr, this.tx));
    this.ty = Math.max(this.h * 0.2, Math.min(this.h - this.pr - 10, this.ty));
    const f = 1 - Math.pow(0.0001, dt);
    this.px += (this.tx - this.px) * f; this.py += (this.ty - this.py) * f;
    this.trail.push({ x: this.px, y: this.py });
    if (this.trail.length > 22) this.trail.shift();

    // combo
    if (this.combo > 1) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 1; this.comboT = 0; }
    }
    this.score += dt * 10 * this.combo;

    // spawn
    this.spawnT -= dt * tScale;
    if (this.spawnT <= 0) { this.spawnRock(); this.spawnT = Math.max(0.16, 0.75 - this.level * 0.06) * (0.6 + Math.random() * 0.6); }
    this.coinT -= dt;
    if (this.coinT <= 0) {
      const x = 30 + Math.random() * (this.w - 60), n = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.coins.push({ x, y: -20 - i * 36, vy: 160 + this.level * 15, t: Math.random() * 6 });
      this.coinT = 1.2 + Math.random() * 1.2;
    }
    this.powerT -= dt;
    if (this.powerT <= 0) {
      const kinds = ["shield", "magnet", "slow"] as const;
      this.powers.push({ x: 40 + Math.random() * (this.w - 80), y: -30, vy: 150, kind: kinds[Math.floor(Math.random() * 3)]!, t: 0 });
      this.powerT = 7 + Math.random() * 4;
    }

    // rocks
    for (const r of this.rocks) {
      r.y += r.vy * dt * tScale; r.x += r.vx * dt * tScale; r.rot += r.vr * dt;
      if (r.x < r.r || r.x > this.w - r.r) r.vx *= -1;
      const d = Math.hypot(r.x - this.px, r.y - this.py), gap = d - r.r * 0.85 - this.pr;
      if (gap < 0) {
        if (this.shield) {
          this.shield = false; r.y = this.h + 999; sfx.shield(); this.shake = 8;
          this.burst(r.x, r.y, 30, "#22e6ff"); this.burst(this.px, this.py, 30, "#22e6ff", 300);
          this.pop(this.px, this.py - 30, "SHIELD!", "#22e6ff");
          continue;
        }
        this.die(); return;
      }
      if (!r.near && gap < 26 && r.y > this.py - 10) {
        r.near = true; this.nearMisses++;
        this.combo = Math.min(10, this.combo + 1); this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboT = 2.5; this.score += 15 * this.combo;
        sfx.near(this.combo);
        this.burst((r.x + this.px) / 2, (r.y + this.py) / 2, 14, r.hue, 180, 2.5);
        this.pop(this.px, this.py - 34, this.combo >= 10 ? "MAX x10!" : `CLOSE! x${this.combo}`, "#ff3df2");
      }
    }
    this.rocks = this.rocks.filter((r) => r.y < this.h + 80);

    for (const c of this.coins) {
      c.t += dt * 6;
      if (this.magnet > 0) {
        const dx = this.px - c.x, dy = this.py - c.y, d = Math.hypot(dx, dy);
        if (d < 260) { c.x += (dx / d) * 520 * dt; c.y += (dy / d) * 520 * dt; continue; }
      }
      c.y += c.vy * dt * tScale;
    }
    this.coins = this.coins.filter((c) => {
      if (Math.hypot(c.x - this.px, c.y - this.py) < this.pr + 12) {
        this.coinCount++; this.score += 25 * this.combo; sfx.coin();
        this.burst(c.x, c.y, 8, "#ffb52e", 120, 2);
        return false;
      }
      return c.y < this.h + 30;
    });

    for (const p of this.powers) { p.y += p.vy * dt * tScale; p.t += dt; }
    this.powers = this.powers.filter((p) => {
      if (Math.hypot(p.x - this.px, p.y - this.py) < this.pr + 18) {
        sfx.power(); this.burst(p.x, p.y, 24, POWER_COLORS[p.kind], 240);
        if (p.kind === "shield") { this.shield = true; this.pop(p.x, p.y, "SHIELD", POWER_COLORS.shield); }
        if (p.kind === "magnet") { this.magnet = 6; this.pop(p.x, p.y, "MAGNET 6s", POWER_COLORS.magnet); }
        if (p.kind === "slow") { this.slow = 3; this.pop(p.x, p.y, "SLOW-MO 3s", POWER_COLORS.slow); }
        return false;
      }
      return p.y < this.h + 40;
    });

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.05;
      this.onHud({ score: Math.floor(this.score), combo: this.combo, comboPct: this.combo > 1 ? this.comboT / 2.5 : 0,
        coins: this.coinCount, level: this.level, shield: this.shield, magnet: this.magnet, slow: this.slow });
    }
  }

  private die() {
    this.dead = true; this.shake = 18; sfx.crash();
    this.burst(this.px, this.py, 80, this.look.glow, 420, 4);
    this.burst(this.px, this.py, 40, "#ffffff", 260, 2);
    if (navigator.vibrate) navigator.vibrate(120);
  }

  private trailColor(i: number) {
    return this.look.trail === "rainbow" ? `hsl(${(this.hue + i * 15) % 360} 100% 60%)` : this.look.trail;
  }

  private drawShip(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.save(); c.translate(x, y);
    c.shadowColor = this.look.glow; c.shadowBlur = 24;
    const g = c.createRadialGradient(0, 0, 1, 0, 0, r);
    g.addColorStop(0, this.look.core); g.addColorStop(1, this.look.glow);
    c.fillStyle = g; c.strokeStyle = this.look.glow; c.lineWidth = 2;
    c.beginPath();
    if (this.look.ship === "ship-dart") { c.moveTo(0, -r * 1.4); c.lineTo(r, r); c.lineTo(0, r * 0.5); c.lineTo(-r, r); c.closePath(); }
    else if (this.look.ship === "ship-diamond") { c.moveTo(0, -r * 1.3); c.lineTo(r, 0); c.lineTo(0, r * 1.3); c.lineTo(-r, 0); c.closePath(); }
    else if (this.look.ship === "ship-hex") { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + this.hue / 60; c.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); } c.closePath(); }
    else c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill(); c.stroke();
    c.restore();
  }

  private draw() {
    const c = this.ctx, w = this.w, h = this.h;
    c.save();
    c.fillStyle = "#05030f"; c.fillRect(0, 0, w, h);
    const bg = c.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, h);
    bg.addColorStop(0, this.slow > 0 ? "rgba(255,61,242,0.14)" : "rgba(60,20,120,0.25)");
    bg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    for (const s of this.stars) { c.fillStyle = `rgba(200,230,255,${s.z * 0.8})`; c.fillRect(s.x, s.y, s.z * 2.2, s.z * 2.2 * (1 + this.level * 0.3)); }

    c.globalCompositeOperation = "lighter";
    for (const co of this.coins) {
      const sx = Math.abs(Math.cos(co.t));
      c.shadowColor = "#ffb52e"; c.shadowBlur = 14; c.fillStyle = "#ffcf5e";
      c.beginPath(); c.ellipse(co.x, co.y, 9 * sx + 1.5, 9, 0, 0, Math.PI * 2); c.fill();
    }
    for (const p of this.powers) {
      const col = POWER_COLORS[p.kind], pulse = 1 + Math.sin(p.t * 8) * 0.12;
      c.shadowColor = col; c.shadowBlur = 22; c.strokeStyle = col; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, 16 * pulse, 0, Math.PI * 2); c.stroke();
      c.fillStyle = col; c.font = "bold 16px Orbitron, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(p.kind === "shield" ? "S" : p.kind === "magnet" ? "M" : "T", p.x, p.y + 1);
    }
    c.globalCompositeOperation = "source-over";

    for (const r of this.rocks) {
      c.save(); c.translate(r.x, r.y); c.rotate(r.rot);
      c.shadowColor = r.hue; c.shadowBlur = 16; c.strokeStyle = r.hue; c.lineWidth = 2.5; c.fillStyle = "#14081f";
      c.beginPath();
      r.verts.forEach((v, i) => { const a = (i / r.verts.length) * Math.PI * 2; c.lineTo(Math.cos(a) * r.r * v, Math.sin(a) * r.r * v); });
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }

    if (this.running && !this.dead) {
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i]!, k = i / this.trail.length;
        c.fillStyle = this.trailColor(i); c.globalAlpha = k * 0.5;
        c.beginPath(); c.arc(t.x, t.y + (this.trail.length - i) * 2, this.pr * k * 0.9, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
      if (this.magnet > 0) { c.strokeStyle = "rgba(255,181,46,0.25)"; c.lineWidth = 1; c.beginPath(); c.arc(this.px, this.py, 60 + Math.sin(this.hue / 10) * 8, 0, Math.PI * 2); c.stroke(); }
      this.drawShip(c, this.px, this.py, this.pr);
      if (this.shield) { c.shadowColor = "#22e6ff"; c.shadowBlur = 20; c.strokeStyle = "rgba(34,230,255,0.8)"; c.lineWidth = 2.5; c.beginPath(); c.arc(this.px, this.py, this.pr + 10, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; }
    } else if (!this.running) {
      this.drawShip(c, w / 2, h * 0.78 + Math.sin(performance.now() / 400) * 6, this.pr);
    }

    c.globalCompositeOperation = "lighter"; c.shadowBlur = 0;
    for (const p of this.parts) { c.globalAlpha = p.life / p.max; c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size); }
    c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
    c.textAlign = "center"; c.textBaseline = "middle";
    for (const p of this.pops) {
      c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 12;
      c.font = "900 20px Orbitron, sans-serif"; c.fillText(p.text, p.x, p.y);
    }
    c.restore();
  }
}
