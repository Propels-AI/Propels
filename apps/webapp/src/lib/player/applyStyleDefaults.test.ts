import { describe, it, expect } from "vitest";
import { applyStyleDefaults } from "./applyStyleDefaults";
import type { TooltipStyle } from "../editor/deriveTooltipStyleFromHotspots";

describe("applyStyleDefaults", () => {
  const defaults: TooltipStyle = {
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
  };

  it("returns empty array for undefined input", () => {
    const res = applyStyleDefaults(undefined, defaults);
    expect(res).toEqual([]);
  });

  it("applies defaults only when fields are missing", () => {
    const list = [
      { id: "a", width: 10, height: 10 },
      { id: "b", width: 10, height: 10, dotSize: 20, dotColor: "#f00", animation: "pulse" as const },
    ];
    const res = applyStyleDefaults(list, defaults);

    expect(res[0].dotSize).toBe(defaults.dotSize);
    expect(res[0].dotColor).toBe(defaults.dotColor);
    expect(res[0].animation).toBe(defaults.animation);

    expect(res[1].dotSize).toBe(20);
    expect(res[1].dotColor).toBe("#f00");
    expect(res[1].animation).toBe("pulse");
  });
});
