import { describe, it, expect } from "vitest";
import { applyGlobalStyleToHotspots } from "./applyGlobalStyleToHotspots";
import type { HotspotsMap, TooltipStyle } from "./deriveTooltipStyleFromHotspots";

describe("applyGlobalStyleToHotspots", () => {
  const current: TooltipStyle = {
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
  };

  const baseMap: HotspotsMap = {
    step1: [
      { id: "a", width: 10, height: 10, dotSize: 8, dotColor: "#111111" },
      { id: "b", width: 10, height: 10 },
    ],
    step2: [
      { id: "c", width: 10, height: 10, dotStrokePx: 1 },
    ],
  };

  it("updates only the fields in patch across all hotspots and preserves others", () => {
    const next = applyGlobalStyleToHotspots(baseMap, current, { dotSize: 20, animation: "pulse" });

    expect(next.step1[0].dotSize).toBe(20);
    expect(next.step1[1].dotSize).toBe(20);

    expect(next.step1[0].animation).toBe("pulse");
    expect(next.step2[0].animation).toBe("pulse");

    // Unchanged fields fall back to hotspot value or current default
    expect(next.step1[0].dotColor).toBe("#111111");
    expect(next.step1[1].dotColor).toBe(current.dotColor);

    // dotStrokePx preserved/filled
    expect(next.step2[0].dotStrokePx).toBe(1);
    expect(next.step1[0].dotStrokePx).toBe(current.dotStrokePx);
  });
});
