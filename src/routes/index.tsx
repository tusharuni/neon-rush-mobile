import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type Hud, type Look } from "@/game/engine";
import { setMuted, sfx, unlockAudio } from "@/game/audio";
import { applyRun, item, load, save, SHOP, type ItemKind, type RunStats, type SaveData } from "@/game/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEON RUSH — One-Thumb Neon Arcade Dodger" },
      { name: "description", content: "Dodge an asteroid storm, chain near-miss combos up to x10, collect coins and unlock neon trails. Instant restarts." },
      { property: "og:title", content: "NEON RUSH — One-Thumb Neon Arcade Dodger" },
      { property: "og:description", content: "Dodge asteroids, chain near-miss combos and beat your best score." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NeonRush,
});

type Screen = "start" | "play" | "over" | "shop";
interface Result extends RunStats { best: number; prevBest: number; bonus: number }

function lookFrom(d: SaveData): Look {
  const skin = item(d.equipped.skin);
  return { trail: item(d.equipped.trail).color, core: skin.color, glow: skin.color2 ?? skin.color, ship: d.equipped.ship };
}

function NeonRush() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [data, setData] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [canRestart, setCanRestart] = useState(false);
  const dataRef = useRef<SaveData | null>(null);

  const commit = useCallback((d: SaveData) => { dataRef.current = d; save(d); setData({ ...d }); }, []);

  useEffect(() => {
    const d = load();
    dataRef.current = d; setData(d); setMuted(d.muted);
    const g = new Game(canvasRef.current!, lookFrom(d), setHud, (s) => {
      const cur = dataRef.current!;
      const prevBest = cur.best;
      const bonus = applyRun(cur, s);
      cur.coins += s.coins + bonus;
      cur.best = Math.max(cur.best, s.score);
      dataRef.current = cur; save(cur); setData({ ...cur });
      setResult({ ...s, best: cur.best, prevBest, bonus });
      setScreen("over"); setCanRestart(false);
      setTimeout(() => setCanRestart(true), 450);
    });
    gameRef.current = g;
    return () => g.destroy();
  }, []);

  const start = useCallback(() => {
    unlockAudio(); sfx.click();
    const g = gameRef.current; if (!g || !dataRef.current) return;
    g.look = lookFrom(dataRef.current);
    g.start(); setPaused(false); setHud(null); setScreen("play");
  }, []);

  const togglePause = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    const p = !g.paused; g.setPaused(p); setPaused(p);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && (screen === "start" || (screen === "over" && canRestart))) { e.preventDefault(); start(); }
      if ((e.key === "p" || e.key === "Escape") && screen === "play") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, canRestart, start, togglePause]);

  useEffect(() => {
    const onHide = () => { if (document.hidden && screen === "play" && gameRef.current && !gameRef.current.paused) togglePause(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [screen, togglePause]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      {data && screen === "start" && <StartScreen data={data} onStart={start} onShop={() => { sfx.click(); setScreen("shop"); }}
        onMute={() => { const d = { ...data, muted: !data.muted }; setMuted(d.muted); commit(d); }} />}
      {screen === "play" && hud && <HudView hud={hud} paused={paused} onPause={togglePause} onQuit={() => { gameRef.current!.running = false; setScreen("start"); }} />}
      {screen === "over" && result && data && <GameOver r={result} total={data.coins} canRestart={canRestart} onRestart={start} onMenu={() => setScreen("start")} />}
      {screen === "shop" && data && <Shop data={data} commit={commit} onBack={() => { sfx.click(); setScreen("start"); }} />}
    </main>
  );
}

function CoinIcon() {
  return <span className="inline-block h-4 w-4 rounded-full bg-accent shadow-[0_0_10px_var(--accent)] align-[-2px]" />;
}

function StartScreen({ data, onStart, onShop, onMute }: { data: SaveData; onStart: () => void; onShop: () => void; onMute: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-6" onClick={onStart}>
      <div className="flex w-full max-w-md items-center justify-between">
        <div className="neon-panel px-3 py-2 font-display text-lg font-bold text-accent"><CoinIcon /> {data.coins}</div>
        <button onClick={(e) => { e.stopPropagation(); onMute(); }} className="neon-btn h-12 w-12 text-sm" aria-label="Toggle sound">{data.muted ? "OFF" : "SFX"}</button>
      </div>
      <h1 className="mt-10 text-center font-display text-6xl font-black leading-none tracking-wider title-gradient">NEON<br />RUSH</h1>
      <p className="mt-3 font-display text-sm tracking-[0.3em] text-muted-foreground">BEST <span className="text-2xl font-black text-primary glow-cyan">{data.best}</span></p>

      <div className="neon-panel mt-6 w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 font-display text-xs font-bold tracking-[0.25em] text-secondary">DAILY MISSIONS</p>
        <ul className="space-y-3">
          {data.missions.map((m) => (
            <li key={m.id}>
              <div className="flex justify-between text-base font-bold">
                <span className={m.claimed ? "text-muted-foreground line-through" : ""}>{m.label}</span>
                <span className="text-accent">{m.claimed ? "DONE" : <>+{m.reward} <CoinIcon /></>}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-secondary shadow-[0_0_8px_var(--secondary)]" style={{ width: `${(m.progress / m.target) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{m.progress}/{m.target}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1" />
      <p className="animate-tap font-display text-2xl font-black tracking-[0.2em] text-primary glow-cyan">TAP TO START</p>
      <p className="mt-2 text-sm text-muted-foreground">Drag to move · Arrows / WASD on desktop</p>
      <button onClick={(e) => { e.stopPropagation(); onShop(); }} className="neon-btn neon-btn-amber mt-5 h-14 w-full max-w-xs text-lg">SHOP</button>
    </div>
  );
}

function HudView({ hud, paused, onPause, onQuit }: { hud: Hud; paused: boolean; onPause: () => void; onQuit: () => void }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-4xl font-black tabular-nums text-foreground glow-cyan">{hud.score}</p>
            <p className="font-display text-sm font-bold text-accent"><CoinIcon /> {hud.coins} <span className="ml-3 text-primary">SPD {hud.level}</span></p>
          </div>
          <button onClick={onPause} className="neon-btn pointer-events-auto h-12 w-12 text-lg" aria-label="Pause">II</button>
        </div>
        <div className="mt-3 flex flex-col items-center">
          <p key={hud.combo} className={`animate-pop font-display font-black text-secondary glow-magenta ${hud.combo > 1 ? "text-6xl" : "text-2xl opacity-40"}`}>x{hud.combo}</p>
          <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-secondary shadow-[0_0_10px_var(--secondary)]" style={{ width: `${hud.comboPct * 100}%` }} />
          </div>
          <div className="mt-2 flex gap-2 font-display text-xs font-bold">
            {hud.shield && <span className="rounded-full border border-primary px-2 py-0.5 text-primary">SHIELD</span>}
            {hud.magnet > 0 && <span className="rounded-full border border-accent px-2 py-0.5 text-accent">MAGNET {hud.magnet.toFixed(1)}</span>}
            {hud.slow > 0 && <span className="rounded-full border border-secondary px-2 py-0.5 text-secondary">SLOW {hud.slow.toFixed(1)}</span>}
          </div>
        </div>
      </div>
      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 backdrop-blur-sm">
          <p className="font-display text-5xl font-black text-primary glow-cyan">PAUSED</p>
          <button onClick={onPause} className="neon-btn h-16 w-64 text-xl">RESUME</button>
          <button onClick={onQuit} className="neon-btn neon-btn-magenta h-14 w-64 text-lg">QUIT</button>
        </div>
      )}
    </>
  );
}

function GameOver({ r, total, canRestart, onRestart, onMenu }: { r: Result; total: number; canRestart: boolean; onRestart: () => void; onMenu: () => void }) {
  const newBest = r.score > r.prevBest && r.score > 0;
  const gap = r.prevBest - r.score;
  let line = "";
  if (newBest) line = r.prevBest > 0 ? `You beat your best by ${r.score - r.prevBest}!` : "First record set!";
  else if (gap <= Math.max(50, r.prevBest * 0.2)) line = `Only ${gap} points from your best!`;
  else line = `${gap} points to beat your best. One more run?`;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 px-6 backdrop-blur-[2px]" onClick={() => canRestart && onRestart()}>
      <p className="font-display text-4xl font-black tracking-wider text-secondary glow-magenta animate-pop">{newBest ? "NEW BEST!" : "CRASHED"}</p>
      <p className="mt-4 font-display text-7xl font-black tabular-nums text-foreground glow-cyan">{r.score}</p>
      <p className="mt-2 text-center text-lg font-bold text-accent">{line}</p>
      <div className="neon-panel mt-6 grid w-full max-w-sm grid-cols-2 gap-3 p-4 text-center">
        <Stat label="BEST" value={r.best} />
        <Stat label="COINS" value={`+${r.coins}`} />
        <Stat label="TIME" value={`${Math.floor(r.time)}s`} />
        <Stat label="MAX COMBO" value={`x${r.maxCombo}`} />
        {r.bonus > 0 && <p className="col-span-2 font-bold text-secondary">Mission bonus +{r.bonus} coins!</p>}
        <p className="col-span-2 text-sm text-muted-foreground">Wallet: {total} coins</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onRestart(); }} className="neon-btn mt-6 h-16 w-full max-w-xs text-2xl">PLAY AGAIN</button>
      <button onClick={(e) => { e.stopPropagation(); onMenu(); }} className="neon-btn neon-btn-magenta mt-3 h-12 w-full max-w-xs text-base">MENU</button>
      <p className="mt-4 animate-tap text-sm text-muted-foreground">or tap anywhere</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-xs font-bold tracking-widest text-muted-foreground">{label}</p><p className="font-display text-2xl font-black">{value}</p></div>;
}

const TABS: { kind: ItemKind; label: string }[] = [{ kind: "trail", label: "TRAILS" }, { kind: "skin", label: "SKINS" }, { kind: "ship", label: "SHIPS" }];

function Shop({ data, commit, onBack }: { data: SaveData; commit: (d: SaveData) => void; onBack: () => void }) {
  const [tab, setTab] = useState<ItemKind>("trail");
  const buy = (id: string) => {
    const it = item(id);
    const d = { ...data, owned: [...data.owned], equipped: { ...data.equipped } };
    if (!d.owned.includes(id)) {
      if (d.coins < it.price) return;
      d.coins -= it.price; d.owned.push(id); sfx.coin();
    } else sfx.click();
    d.equipped[it.kind] = id;
    commit(d);
  };
  return (
    <div className="absolute inset-0 flex flex-col bg-background/80 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <button onClick={onBack} className="neon-btn h-12 px-4 text-sm">BACK</button>
        <h2 className="font-display text-3xl font-black text-accent glow-amber">SHOP</h2>
        <div className="neon-panel px-3 py-2 font-display font-bold text-accent"><CoinIcon /> {data.coins}</div>
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-md grid-cols-3 gap-2">
        {TABS.map((t) => (
          <button key={t.kind} onClick={() => { sfx.click(); setTab(t.kind); }} className={`neon-btn h-12 text-sm ${tab === t.kind ? "" : "opacity-50"}`}>{t.label}</button>
        ))}
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-md flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-4">
        {SHOP.filter((s) => s.kind === tab).map((s) => {
          const owned = data.owned.includes(s.id), equipped = data.equipped[s.kind] === s.id, afford = data.coins >= s.price;
          const bg = s.color === "rainbow" ? "conic-gradient(#22e6ff,#ff3df2,#ffb52e,#8dff3d,#22e6ff)" : `radial-gradient(circle, ${s.color}, ${s.color2 ?? s.color})`;
          return (
            <button key={s.id} onClick={() => buy(s.id)} disabled={!owned && !afford}
              className={`neon-panel flex flex-col items-center gap-2 p-4 transition active:scale-95 disabled:opacity-40 ${equipped ? "border-primary shadow-[0_0_18px_var(--primary)]" : ""}`}>
              <span className={`h-14 w-14 ${s.kind === "ship" && s.id !== "ship-orb" ? "rotate-45 rounded-md" : "rounded-full"}`} style={{ background: bg, boxShadow: `0 0 20px ${s.color2 ?? (s.color === "rainbow" ? "#ff3df2" : s.color)}` }} />
              <span className="font-display text-sm font-bold">{s.name}</span>
              <span className="text-sm font-bold text-accent">{equipped ? "EQUIPPED" : owned ? "EQUIP" : <><CoinIcon /> {s.price}</>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
