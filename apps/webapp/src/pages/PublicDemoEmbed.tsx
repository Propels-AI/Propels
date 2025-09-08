import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { createLeadSubmissionPublic } from "@/lib/api/demos";
import HotspotOverlay from "@/components/HotspotOverlay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import { usePublicDemo } from "@/features/public/hooks/usePublicDemo";
import { useImageResolver } from "@/features/public/hooks/useImageResolver";
import outputs from "../../../../amplify_outputs.json";

// type removed after refactor (now handled by usePublicDemo)

export default function PublicDemoEmbed() {
  const { demoId } = useParams();
  const location = useLocation();
  const { loading, error, leadStepIndex, leadBg, leadConfig, steps, hotspotStyleDefaults } = usePublicDemo(demoId);
  const [currentIndex, setCurrentIndex] = useState(0);

  let displayTotal = steps.length + (leadStepIndex !== null ? 1 : 0);
  const isLeadDisplayIndex = leadStepIndex !== null && currentIndex === leadStepIndex;
  const mapDisplayToReal = (di: number) => {
    if (leadStepIndex === null) return di;
    return di < leadStepIndex ? di : di - 1;
  };
  const currentRealIndex = isLeadDisplayIndex ? -1 : mapDisplayToReal(currentIndex);
  const current = currentRealIndex >= 0 ? steps[currentRealIndex] : undefined;

  const forcedAspect: string | null = useMemo(() => {
    try {
      const ar = new URLSearchParams(location.search).get("ar");
      if (!ar) return null;
      const cleaned = String(ar).replace(/\s+/g, "");
      const parts = cleaned.includes(":") ? cleaned.split(":") : cleaned.split("/");
      if (parts.length === 2) {
        const w = Number(parts[0]);
        const h = Number(parts[1]);
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return `${w} / ${h}`;
      }
      return null;
    } catch {
      return null;
    }
  }, [location.search]);
  const imageSrc = useMemo(() => {
    const raw = current?.s3Key || current?.thumbnailS3Key;
    if (!raw) return undefined;
    const isUrl = /^(https?:)?\/\//i.test(raw);
    const base = import.meta.env.VITE_PUBLIC_ASSET_BASE_URL as string | undefined;
    const finalSrc = isUrl
      ? raw
      : base
        ? `${String(base).replace(/\/$/, "")}/${String(raw).replace(/^\//, "")}`
        : undefined;
    return finalSrc;
  }, [current]);
  const bucket = (outputs as any)?.storage?.bucket;
  const region = (outputs as any)?.aws_region || (outputs as any)?.awsRegion || (outputs as any)?.region;
  const { resolvedSrc, naturalAspect } = useImageResolver(
    current?.s3Key || current?.thumbnailS3Key,
    imageSrc,
    true,
    { bucket, region }
  );

  const currentHotspots = useMemo(() => {
    if (currentRealIndex < 0) return [] as any[];
    const s = steps[currentRealIndex];
    return (s?.hotspots || []).map((h) => ({
      ...h,
      dotSize: h.dotSize ?? hotspotStyleDefaults.dotSize,
      dotColor: h.dotColor ?? hotspotStyleDefaults.dotColor,
      dotStrokePx: h.dotStrokePx ?? hotspotStyleDefaults.dotStrokePx,
      dotStrokeColor: h.dotStrokeColor ?? hotspotStyleDefaults.dotStrokeColor,
      animation: (h.animation ?? hotspotStyleDefaults.animation) as any,
      // Tooltip bubble styling & offsets defaults from METADATA.hotspotStyle
      tooltipBgColor: (h as any).tooltipBgColor ?? hotspotStyleDefaults.tooltipBgColor,
      tooltipTextColor: (h as any).tooltipTextColor ?? hotspotStyleDefaults.tooltipTextColor,
      tooltipTextSizePx: (h as any).tooltipTextSizePx ?? hotspotStyleDefaults.tooltipTextSizePx,
      tooltipOffsetXNorm: (h as any).tooltipOffsetXNorm ?? hotspotStyleDefaults.tooltipOffsetXNorm,
      tooltipOffsetYNorm: (h as any).tooltipOffsetYNorm ?? hotspotStyleDefaults.tooltipOffsetYNorm,
    }));
  }, [steps, currentRealIndex, hotspotStyleDefaults]);

  if (!demoId) return <div className="p-4 text-sm">Missing demoId</div>;
  if (loading) return <div className="p-4 text-sm">Loading…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (displayTotal === 0) return <div className="p-4 text-sm">No steps available</div>;

  const go = (d: number) => {
    const next = Math.max(0, Math.min(displayTotal - 1, currentIndex + d));
    setCurrentIndex(next);
  };

  return (
    <div className="w-full bg-transparent">
      <div className="relative w-full" style={{ aspectRatio: forcedAspect || naturalAspect || "16 / 10" }}>
        {isLeadDisplayIndex ? (
          <>
            <LeadCaptureOverlay
              bg={leadBg}
              config={leadConfig as any}
              onSubmit={async (form) => {
                try {
                  await createLeadSubmissionPublic({
                    demoId: demoId!,
                    email: form.email || form.Email,
                    fields: form,
                    pageUrl: window.location.href,
                    stepIndex: leadStepIndex ?? undefined,
                    source: "embed",
                    userAgent: navigator.userAgent,
                    referrer: document.referrer,
                  });
                } catch (e) {
                  console.warn("Lead submission failed", e);
                }
              }}
            />
            {/* Default lead form warning removed */}
          </>
        ) : (
          <HotspotOverlay
            className="absolute inset-0 w-full h-full"
            imageUrl={resolvedSrc}
            hotspots={currentHotspots as any}
          />
        )}
        <button
          aria-label="Previous step"
          onClick={() => go(-1)}
          disabled={currentIndex === 0}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-50 rounded-full p-2 bg-white/80 hover:bg-white shadow ${
            currentIndex === 0 ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          aria-label="Next step"
          onClick={() => go(1)}
          disabled={currentIndex >= displayTotal - 1}
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-50 rounded-full p-2 bg-white/80 hover:bg-white shadow ${
            currentIndex >= displayTotal - 1 ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="absolute left-3 right-3 bottom-3 z-40 pointer-events-none">
          <div className="relative w-full h-1.5 bg-black/15 rounded overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-600"
              style={{ width: `${((currentIndex + 1) / displayTotal) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
