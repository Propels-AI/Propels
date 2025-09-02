import { describe, it, expect } from "vitest";
import { deriveTooltipStyleFromHotspots, type HotspotsMap, type TooltipStyle } from "./deriveTooltipStyleFromHotspots";

describe("deriveTooltipStyleFromHotspots", () => {
  const defaults: TooltipStyle = {
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
  };

  it("returns defaults when no hotspots exist", () => {
    const map: HotspotsMap = {};
    const result = deriveTooltipStyleFromHotspots(map, defaults);
    expect(result).toEqual(defaults);
  });

  it("derives from the first available hotspot", () => {
    const map: HotspotsMap = {
      step1: [
        {
          id: "h1",
          width: 10,
          height: 10,
          dotSize: 20,
          dotColor: "#ff0000",
          dotStrokePx: 3,
          dotStrokeColor: "#00ff00",
          animation: "pulse",
        },
      ],
    };
    const result = deriveTooltipStyleFromHotspots(map, defaults);
    expect(result).toEqual({
      dotSize: 20,
      dotColor: "#ff0000",
      dotStrokePx: 3,
      dotStrokeColor: "#00ff00",
      animation: "pulse",
    });
  });

  it("falls back per-field to defaults when hotspot omits a field", () => {
    const map: HotspotsMap = {
      step1: [
        {
          id: "h1",
          width: 10,
          height: 10,
          dotSize: 16,
          // dotColor missing
          dotStrokePx: 0,
          // dotStrokeColor missing
          // animation missing
        },
      ],
    };
    const result = deriveTooltipStyleFromHotspots(map, defaults);
    expect(result).toEqual({
      dotSize: 16,
      dotColor: defaults.dotColor,
      dotStrokePx: 0,
      dotStrokeColor: defaults.dotStrokeColor,
      animation: defaults.animation,
    });
  });
});
