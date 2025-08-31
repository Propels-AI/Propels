import React, { useEffect, useMemo, useRef, useState } from "react";

export type Hotspot = {
  id: string;
  xNorm?: number;
  yNorm?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tooltip?: any;
  dotSize?: number; // px
  dotColor?: string; // e.g., #2563eb
  animation?: "none" | "pulse" | "breathe" | "fade";
  dotStrokePx?: number; // border width in px
  dotStrokeColor?: string; // border color
};

export type HotspotOverlayProps = {
  imageUrl?: string;
  hotspots?: Hotspot[];
  className?: string;
  onHotspotClick?: (id: string) => void;
};

export const HotspotOverlay: React.FC<HotspotOverlayProps> = ({ imageUrl, hotspots = [], className, onHotspotClick }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const id = "propels-tooltip-animations";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
@keyframes propels-breathe { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.08); opacity: 1; } }
@keyframes propels-fade { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
`;
    document.head.appendChild(style);
    return () => {
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

  const measure = () => {
    const el = wrapperRef.current;
    const img = imgRef.current;
    if (!el || !img) return;
    const rect = el.getBoundingClientRect();
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) return;
    // object-contain box inside container
    const containerW = rect.width;
    const containerH = rect.height;
    const imageAspect = naturalW / naturalH;
    const containerAspect = containerW / containerH;
    let renderW = 0, renderH = 0, left = 0, top = 0;
    if (containerAspect > imageAspect) {
      // pillarbox
      renderH = containerH;
      renderW = imageAspect * renderH;
      left = (containerW - renderW) / 2;
      top = 0;
    } else {
      // letterbox
      renderW = containerW;
      renderH = renderW / imageAspect;
      left = 0;
      top = (containerH - renderH) / 2;
    }
    setBox({ left, top, width: renderW, height: renderH });
  };

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [imageUrl]);

  const normalizeTooltip = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      const keys = ["tooltip", "tooltipText", "text", "label", "content", "title", "message", "description", "value"];
      for (const k of keys) {
        if (k in v && typeof (v as any)[k] !== "undefined") {
          const s = normalizeTooltip((v as any)[k]);
          if (s) return s;
        }
      }
      try {
        for (const [, val] of Object.entries(v)) {
          const s = normalizeTooltip(val);
          if (s) return s;
        }
      } catch {}
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return "";
  };

  const first = hotspots[0] || {};
  const stepStyleDefaults = useMemo(() => ({
    dotSize: Number(first.dotSize ?? 12),
    dotColor: String(first.dotColor ?? "#2563eb"),
    dotStrokePx: Number(first.dotStrokePx ?? 2),
    dotStrokeColor: String(first.dotStrokeColor ?? "#ffffff"),
    animation: (first.animation ?? "none") as "none" | "pulse" | "breathe" | "fade",
  }), [first]);

  return (
    <div ref={wrapperRef} className={className}>
      <div className="relative w-full h-full">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imgRef} src={imageUrl} alt="Step" className="absolute inset-0 w-full h-full object-contain" onLoad={measure} />
        ) : (
          <span className="text-gray-500">No image</span>
        )}

        {hotspots.map((h) => {
          const style: React.CSSProperties = {};
          const defaultSize = stepStyleDefaults.dotSize || 12;
          const dotSize = Math.max(6, Math.min(48, Number((h as any).dotSize ?? defaultSize)));

          if (box && typeof h.xNorm === "number" && typeof h.yNorm === "number") {
            const left = box.left + h.xNorm * box.width - dotSize / 2;
            const top = box.top + h.yNorm * box.height - dotSize / 2;
            style.left = `${left}px`;
            style.top = `${top}px`;
            style.width = `${dotSize}px`;
            style.height = `${dotSize}px`;
          } else if (!box && typeof h.x === "number" && typeof h.y === "number") {
            style.left = `${h.x}px`;
            style.top = `${h.y}px`;
            style.width = `${(h as any).width || dotSize}px`;
            style.height = `${(h as any).height || dotSize}px`;
          }

          const tooltipText = normalizeTooltip((h as any).tooltip ?? h);
          const hasTooltip = !!tooltipText && tooltipText.trim().length > 0;

          const color = (h as any).dotColor || stepStyleDefaults.dotColor || "#2563eb";
          const anim = (h as any).animation || stepStyleDefaults.animation || "none";
          const animStyle: React.CSSProperties =
            anim === "pulse" ? {} :
            anim === "breathe" ? { animation: "propels-breathe 1.8s ease-in-out infinite" } :
            anim === "fade" ? { animation: "propels-fade 1.4s ease-in-out infinite" } : {};

          const stroke = Math.max(0, Number((h as any).dotStrokePx ?? stepStyleDefaults.dotStrokePx ?? 2));
          const strokeColor = (h as any).dotStrokeColor ?? stepStyleDefaults.dotStrokeColor ?? "#ffffff";

          return (
            <div key={h.id} className="absolute group" style={style} onClick={() => onHotspotClick?.(h.id)}>
              <div
                className={`rounded-full shadow ${anim === "pulse" ? "animate-pulse" : ""}`}
                style={{ width: dotSize, height: dotSize, backgroundColor: color, borderStyle: "solid", borderWidth: stroke, borderColor: strokeColor, ...animStyle }}
              />
              {hasTooltip && (
                <div className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 whitespace-pre px-2 py-1 text-xs text-white bg-blue-600 rounded shadow opacity-100 pointer-events-none">
                  {tooltipText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HotspotOverlay;
