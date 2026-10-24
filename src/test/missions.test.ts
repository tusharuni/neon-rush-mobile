import { describe, expect, it } from "vitest";
import { applyRun, dailyMissions, load } from "@/game/storage";

describe("daily missions", () => {
  it("gives three distinct missions per day", () => {
    for (const d of ["2026-10-24", "2026-10-25", "2026-01-01"]) {
      const m = dailyMissions(d);
      expect(m).toHaveLength(3);
      expect(new Set(m.map((x) => x.type)).size).toBe(3);
    }
  });
  it("awards bonus once when a mission completes", () => {
    const d = load();
    d.missions = dailyMissions("2026-10-24");
    const run = { time: 999, coins: 999, maxCombo: 10, score: 99999, nearMisses: 999 };
    const total = d.missions.reduce((s, m) => s + m.reward, 0);
    expect(applyRun(d, run)).toBe(total);
    expect(applyRun(d, run)).toBe(0);
  });
});
