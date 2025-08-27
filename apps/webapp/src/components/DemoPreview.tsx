import React, { useEffect, useMemo, useRef, useState } from "react";

export type Hotspot = {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  xNorm?: number;
  yNorm?: number;
  tooltip?: any;
  targetStep?: number;
  // Styling
  dotSize?: number; // px
  dotColor?: string; // hex/rgb
  animation?: "none" | "pulse" | "breathe" | "fade";
  dotStrokePx?: number; // border width in px
  dotStrokeColor?: string; // border color
};

export type DemoPreviewStep = {
  id: string;
  imageUrl?: string; // absolute URL or data URL to render for the current step
  hotspots?: Hotspot[];
  pageUrl?: string;
};

export function DemoPreview(props: {
  steps: DemoPreviewStep[];
  currentIndex: number;
  onIndexChange?: (idx: number) => void;
  showNavigation?: boolean;
  className?: string;
}) {
  const { steps, currentIndex, onIndexChange, showNavigation = false, className } = props;
  const step = steps[currentIndex];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | undefined>();

  useEffect(() => {
    function recompute() {
      const c = containerRef.current;
      const img = imgRef.current;
      if (!c || !img) {
        setBox(undefined);
        return;
      }
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      const iw = img.clientWidth;
      const ih = img.clientHeight;
      const left = Math.max(0, (cw - iw) / 2);
      const top = Math.max(0, (ch - ih) / 2);
      setBox({ left, top, width: iw, height: ih });
    }
    recompute();
    const onR = () => recompute();
    window.addEventListener("resize", onR);
    const t = setTimeout(recompute, 0);
    return () => {
      window.removeEventListener("resize", onR);
      clearTimeout(t);
    };
  }, [step?.imageUrl]);

  // Inject animations used for hotspots if not present
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
      try { document.head.removeChild(style); } catch {}
    };
  }, []);

  const normalizedHotspots = useMemo(() => step?.hotspots || [], [step]);

  const go = (d: number) => {
    if (!onIndexChange) return;
    const next = Math.max(0, Math.min(steps.length - 1, currentIndex + d));
    onIndexChange(next);
  };

  return (
    <div className={className}>
      {showNavigation && (
        <div className="flex items-center justify-between mb-3">
          <button className="px-3 py-1 border rounded" onClick={() => go(-1)} disabled={currentIndex <= 0}>
            Prev
          </button>
          <div className="text-sm text-gray-700">
            Step {currentIndex + 1} of {steps.length}
          </div>
          <button
            className="px-3 py-1 border rounded"
            onClick={() => go(1)}
            disabled={currentIndex >= steps.length - 1}
          >
            Next
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="bg-black/5 border rounded-xl w-full max-w-5xl h-[70vh] flex items-center justify-center relative overflow-hidden"
      >
        {step?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={imgRef} src={step.imageUrl} alt="Step" className="max-w-full max-h-full object-contain" />
        ) : (
          <span className="text-gray-500">No image</span>
        )}

        {normalizedHotspots.map((h) => {
          const style: React.CSSProperties = {};
          const defaultSize = 12;
          if (box && typeof h.xNorm === "number" && typeof h.yNorm === "number") {
            const widthPx =
              typeof h.width === "number" ? (h.width > 0 && h.width <= 1 ? h.width * box.width : h.width) : defaultSize;
            const heightPx =
              typeof h.height === "number"
                ? h.height > 0 && h.height <= 1
                  ? h.height * box.height
                  : h.height
                : defaultSize;
            const left = box.left + h.xNorm * box.width - widthPx / 2;
            const top = box.top + h.yNorm * box.height - heightPx / 2;
            style.left = `${left}px`;
            style.top = `${top}px`;
            style.width = `${widthPx}px`;
            style.height = `${heightPx}px`;
          } else if (typeof h.x === "number" && typeof h.y === "number") {
            style.left = `${h.x}px`;
            style.top = `${h.y}px`;
            style.width = `${(h as any).width || defaultSize}px`;
            style.height = `${(h as any).height || defaultSize}px`;
          }

          // Normalize tooltip text from various shapes/keys
          const normalizeTooltip = (v: any): string => {
            if (v == null) return "";
            if (typeof v === "string") return v;
            if (typeof v === "number" || typeof v === "boolean") return String(v);
            if (typeof v === "object") {
              // common keys
              const keys = ["tooltip", "text", "label", "content", "title", "message", "description"];
              for (const k of keys) {
                if (k in v && typeof (v as any)[k] !== "undefined") {
                  const s = normalizeTooltip((v as any)[k]);
                  if (s) return s;
                }
              }
              // fallback: first string leaf
              try {
                const entries = Object.entries(v as any);
                for (const [, val] of entries) {
                  const s = normalizeTooltip(val);
                  if (s) return s;
                }
              } catch {}
              // last resort
              try {
                return JSON.stringify(v);
              } catch {
                return String(v);
              }
            }
            return "";
          };

          const tooltipText = normalizeTooltip((h as any).tooltip ?? h);
          const hasTooltip = !!tooltipText && tooltipText.trim().length > 0;

          const dotSize = Math.max(6, Math.min(48, Number((h as any).dotSize ?? 12)));
          const color = (h as any).dotColor || "#2563eb";
          const anim = (h as any).animation || "none";
          const animStyle: React.CSSProperties =
            anim === "pulse"
              ? {}
              : anim === "breathe"
              ? { animation: "propels-breathe 1.8s ease-in-out infinite" }
              : anim === "fade"
              ? { animation: "propels-fade 1.4s ease-in-out infinite" }
              : {};

          const stroke = Math.max(0, Number((h as any).dotStrokePx ?? 2));
          const strokeColor = (h as any).dotStrokeColor ?? "#ffffff";
          return (
            <div key={h.id} className="absolute group" style={style}>
              <div
                className={`rounded-full shadow ${anim === "pulse" ? "animate-pulse" : ""}`}
                style={{ width: dotSize, height: dotSize, backgroundColor: color, borderStyle: "solid", borderWidth: stroke, borderColor: strokeColor, ...animStyle }}
              />
              {hasTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full whitespace-pre px-2 py-1 text-xs text-white bg-blue-600 rounded shadow opacity-100 pointer-events-none">
                  {tooltipText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
