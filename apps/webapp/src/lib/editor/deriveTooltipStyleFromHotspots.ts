export type TooltipStyle = {
  dotSize: number;
  dotColor: string;
  dotStrokePx: number;
  dotStrokeColor: string;
  animation: "none" | "pulse" | "breathe" | "fade";
  // Tooltip text bubble styles
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  tooltipTextSizePx?: number;
};

export type Hotspot = {
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

export type HotspotsMap = Record<string, Hotspot[]>;

export function deriveTooltipStyleFromHotspots(map: HotspotsMap, defaults: TooltipStyle): TooltipStyle {
  for (const list of Object.values(map)) {
    if (Array.isArray(list) && list.length > 0) {
      const h = list[0] as Hotspot;
      return {
        dotSize: Number(h.dotSize ?? defaults.dotSize),
        dotColor: String(h.dotColor ?? defaults.dotColor),
        dotStrokePx: Number(h.dotStrokePx ?? defaults.dotStrokePx),
        dotStrokeColor: String(h.dotStrokeColor ?? defaults.dotStrokeColor),
        animation: (h.animation ?? defaults.animation) as TooltipStyle["animation"],
        tooltipBgColor: String((h as any).tooltipBgColor ?? (defaults as any).tooltipBgColor ?? "#2563eb"),
        tooltipTextColor: String((h as any).tooltipTextColor ?? (defaults as any).tooltipTextColor ?? "#ffffff"),
        tooltipTextSizePx: Number((h as any).tooltipTextSizePx ?? (defaults as any).tooltipTextSizePx ?? 12),
      };
    }
  }
  return { ...defaults };
}
