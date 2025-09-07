import type { Hotspot, HotspotsMap, TooltipStyle } from "./deriveTooltipStyleFromHotspots";

export function applyGlobalStyleToHotspots(
  map: HotspotsMap,
  current: TooltipStyle,
  patch: Partial<TooltipStyle>
): HotspotsMap {
  const next: HotspotsMap = {};
  for (const [stepId, list] of Object.entries(map)) {
    next[stepId] = (list || []).map((h: Hotspot) => ({
      ...h,
      dotSize: typeof patch.dotSize === "number" ? patch.dotSize : (h.dotSize ?? current.dotSize),
      dotColor: typeof patch.dotColor === "string" ? patch.dotColor : (h.dotColor ?? current.dotColor),
      dotStrokePx: typeof patch.dotStrokePx === "number" ? patch.dotStrokePx : (h.dotStrokePx ?? current.dotStrokePx),
      dotStrokeColor:
        typeof patch.dotStrokeColor === "string" ? patch.dotStrokeColor : (h.dotStrokeColor ?? current.dotStrokeColor),
      animation: (patch.animation ?? h.animation ?? current.animation) as TooltipStyle["animation"],
      tooltipBgColor:
        typeof (patch as any).tooltipBgColor === "string"
          ? (patch as any).tooltipBgColor
          : ((h as any).tooltipBgColor ?? (current as any).tooltipBgColor),
      tooltipTextColor:
        typeof (patch as any).tooltipTextColor === "string"
          ? (patch as any).tooltipTextColor
          : ((h as any).tooltipTextColor ?? (current as any).tooltipTextColor),
      tooltipTextSizePx:
        typeof (patch as any).tooltipTextSizePx === "number"
          ? (patch as any).tooltipTextSizePx
          : ((h as any).tooltipTextSizePx ?? (current as any).tooltipTextSizePx),
    }));
  }
  return next;
}
