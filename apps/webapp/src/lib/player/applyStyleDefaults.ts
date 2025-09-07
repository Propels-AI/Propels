import type { TooltipStyle } from "../editor/deriveTooltipStyleFromHotspots";

export type PublicHotspot = {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  xNorm?: number;
  yNorm?: number;
  tooltip?: string;
  dotSize?: number;
  dotColor?: string;
  dotStrokePx?: number;
  dotStrokeColor?: string;
  animation?: TooltipStyle["animation"];
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  tooltipTextSizePx?: number;
};

export function applyStyleDefaults<T extends PublicHotspot>(list: T[] | undefined, defaults: TooltipStyle): T[] {
  if (!Array.isArray(list)) return [];
  return list.map((h) => ({
    ...h,
    dotSize: typeof h.dotSize === "number" ? h.dotSize : defaults.dotSize,
    dotColor: typeof h.dotColor === "string" ? h.dotColor : defaults.dotColor,
    dotStrokePx: typeof h.dotStrokePx === "number" ? h.dotStrokePx : defaults.dotStrokePx,
    dotStrokeColor: typeof h.dotStrokeColor === "string" ? h.dotStrokeColor : defaults.dotStrokeColor,
    animation: (h.animation ?? defaults.animation) as TooltipStyle["animation"],
    tooltipBgColor: (h as any).tooltipBgColor ?? (defaults as any).tooltipBgColor ?? "#2563eb",
    tooltipTextColor: (h as any).tooltipTextColor ?? (defaults as any).tooltipTextColor ?? "#ffffff",
    tooltipTextSizePx: (h as any).tooltipTextSizePx ?? (defaults as any).tooltipTextSizePx ?? 12,
  }));
}
