export type ItemKind = "trail" | "skin" | "ship";
export interface ShopItem { id: string; kind: ItemKind; name: string; price: number; color: string; color2?: string }

export const SHOP: ShopItem[] = [
  { id: "trail-cyan", kind: "trail", name: "Cyan Stream", price: 0, color: "#22e6ff" },
  { id: "trail-magenta", kind: "trail", name: "Magenta Haze", price: 60, color: "#ff3df2" },
  { id: "trail-amber", kind: "trail", name: "Amber Comet", price: 90, color: "#ffb52e" },
  { id: "trail-lime", kind: "trail", name: "Toxic Lime", price: 140, color: "#8dff3d" },
  { id: "trail-rainbow", kind: "trail", name: "Prism", price: 300, color: "rainbow" },
  { id: "skin-core", kind: "skin", name: "Pulse Core", price: 0, color: "#e8fdff", color2: "#22e6ff" },
  { id: "skin-plasma", kind: "skin", name: "Plasma", price: 80, color: "#ffe0fb", color2: "#ff3df2" },
  { id: "skin-sun", kind: "skin", name: "Solar", price: 120, color: "#fff3cf", color2: "#ffb52e" },
  { id: "skin-void", kind: "skin", name: "Void", price: 220, color: "#1a0630", color2: "#b47cff" },
  { id: "ship-orb", kind: "ship", name: "Orb", price: 0, color: "#22e6ff" },
  { id: "ship-dart", kind: "ship", name: "Dart", price: 150, color: "#ff3df2" },
  { id: "ship-diamond", kind: "ship", name: "Diamond", price: 200, color: "#ffb52e" },
  { id: "ship-hex", kind: "ship", name: "Hex", price: 260, color: "#8dff3d" },
];

export type MissionType = "survive" | "coins" | "combo" | "score" | "nearmiss";
export interface Mission { id: string; type: MissionType; target: number; reward: number; label: string; progress: number; claimed: boolean }

export interface SaveData {
  coins: number; best: number; owned: string[];
  equipped: Record<ItemKind, string>;
  missionsDate: string; missions: Mission[]; muted: boolean;
}

const KEY = "neon-rush-save-v1";

const POOL: Omit<Mission, "id" | "progress" | "claimed">[] = [
  { type: "survive", target: 60, reward: 40, label: "Survive 60s in one run" },
  { type: "survive", target: 30, reward: 20, label: "Survive 30s in one run" },
  { type: "coins", target: 50, reward: 40, label: "Collect 50 coins today" },
  { type: "coins", target: 25, reward: 20, label: "Collect 25 coins today" },
  { type: "combo", target: 5, reward: 35, label: "Reach a x5 combo" },
  { type: "combo", target: 8, reward: 60, label: "Reach a x8 combo" },
  { type: "score", target: 1500, reward: 40, label: "Score 1,500 in one run" },
  { type: "nearmiss", target: 40, reward: 35, label: "40 near misses today" },
];

export const today = () => new Date().toISOString().slice(0, 10);

export function dailyMissions(date: string): Mission[] {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const types = new Set<MissionType>();
  const out: Mission[] = [];
  let i = 0;
  while (out.length < 3 && i < 50) {
    h = (h * 1103515245 + 12345) >>> 0;
    const m = POOL[(h >>> 16) % POOL.length]!;
    if (!types.has(m.type)) { types.add(m.type); out.push({ ...m, id: `${date}-${out.length}`, progress: 0, claimed: false }); }
    i++;
  }
  return out;
}

function fresh(): SaveData {
  return {
    coins: 0, best: 0, owned: ["trail-cyan", "skin-core", "ship-orb"],
    equipped: { trail: "trail-cyan", skin: "skin-core", ship: "ship-orb" },
    missionsDate: today(), missions: dailyMissions(today()), muted: false,
  };
}

export function load(): SaveData {
  let d = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) d = { ...d, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  if (d.missionsDate !== today()) { d.missionsDate = today(); d.missions = dailyMissions(today()); }
  return d;
}

export function save(d: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

export interface RunStats { time: number; coins: number; maxCombo: number; score: number; nearMisses: number }

/** Applies a run to missions; returns bonus coins awarded. */
export function applyRun(d: SaveData, r: RunStats): number {
  let bonus = 0;
  for (const m of d.missions) {
    if (m.claimed) continue;
    if (m.type === "survive") m.progress = Math.max(m.progress, Math.floor(r.time));
    if (m.type === "coins") m.progress += r.coins;
    if (m.type === "combo") m.progress = Math.max(m.progress, r.maxCombo);
    if (m.type === "score") m.progress = Math.max(m.progress, Math.floor(r.score));
    if (m.type === "nearmiss") m.progress += r.nearMisses;
    if (m.progress >= m.target) { m.progress = m.target; m.claimed = true; bonus += m.reward; }
  }
  return bonus;
}

export const item = (id: string) => SHOP.find((s) => s.id === id)!;
