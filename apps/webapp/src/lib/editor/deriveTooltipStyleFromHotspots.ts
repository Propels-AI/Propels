export type TooltipStyle = {
  dotSize: number;
  dotColor: string;
  dotStrokePx: number;
  dotStrokeColor: string;
  animation: "none" | "pulse" | "breathe" | "fade";
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
};

export type HotspotsMap = Record<string, Hotspot[]>;

export function deriveTooltipStyleFromHotspots(
  map: HotspotsMap,
  defaults: TooltipStyle
): TooltipStyle {
  for (const list of Object.values(map)) {
    if (Array.isArray(list) && list.length > 0) {
      const h = list[0] as Hotspot;
      return {
        dotSize: Number(h.dotSize ?? defaults.dotSize),
        dotColor: String(h.dotColor ?? defaults.dotColor),
        dotStrokePx: Number(h.dotStrokePx ?? defaults.dotStrokePx),
        dotStrokeColor: String(h.dotStrokeColor ?? defaults.dotStrokeColor),
        animation: (h.animation ?? defaults.animation) as TooltipStyle["animation"],
      };
    }
  }
  return { ...defaults };
}
