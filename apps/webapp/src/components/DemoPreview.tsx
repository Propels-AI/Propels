import { useMemo } from "react";
import HotspotOverlay from "./HotspotOverlay";

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

      <HotspotOverlay
        className="bg-black/5 border rounded-xl w-full max-w-5xl h-[70vh] flex items-center justify-center relative overflow-hidden"
        imageUrl={step?.imageUrl}
        hotspots={normalizedHotspots as any}
      />
    </div>
  );
}
