import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createLeadSubmissionPublic } from "@/lib/api/demos";
import HotspotOverlay from "@/components/HotspotOverlay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import { usePublicDemo } from "@/features/public/hooks/usePublicDemo";
import { useImageResolver } from "@/features/public/hooks/useImageResolver";
import outputs from "../../../../amplify_outputs.json";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PublicDemoPlayer() {
  const { demoId } = useParams();
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
  const { resolvedSrc, naturalAspect } = useImageResolver(current?.s3Key || current?.thumbnailS3Key, imageSrc, true, {
    bucket,
    region,
  });

  // Stable step IDs to prevent unnecessary re-renders during data refresh
  const stepIds = useMemo(() => steps.map(s => s.itemSK).join(','), [steps]);
  
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
  }, [stepIds, currentRealIndex, hotspotStyleDefaults]);

  if (!demoId)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">We couldn't load this demo</CardTitle>
            <CardDescription>It may have been deleted, moved, or not published yet.</CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://propels.ai" target="_blank" rel="noreferrer">
                Visit propels.ai
              </a>
            </Button>
            <Button asChild size="sm">
              <a
                href={`mailto:support@propels.ai?subject=${encodeURIComponent("Public demo unavailable")}&body=${encodeURIComponent(
                  `The demo ${demoId || "(unknown)"} isn't available.`
                )}`}
              >
                Report an issue
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (displayTotal === 0)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">We couldn't load this demo</CardTitle>
            <CardDescription>It may have been deleted, moved, or not published yet.</CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://propels.ai" target="_blank" rel="noreferrer">
                Visit propels.ai
              </a>
            </Button>
            <Button asChild size="sm">
              <a
                href={`mailto:support@propels.ai?subject=${encodeURIComponent("Public demo unavailable")}&body=${encodeURIComponent(
                  `The demo ${demoId || "(unknown)"} isn't available.`
                )}`}
              >
                Report an issue
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );

  const go = (d: number) => {
    const next = Math.max(0, Math.min(displayTotal - 1, currentIndex + d));
    setCurrentIndex(next);
  };

  return (
    <div className="w-full bg-transparent">
      <div className="relative w-full" style={{ aspectRatio: naturalAspect || "16 / 10" }}>
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
                    source: "public",
                    userAgent: navigator.userAgent,
                    referrer: document.referrer,
                  });
                } catch (e) {
                  console.warn("Lead submission failed", e);
                }
              }}
              onDismiss={() => {
                // Continue to next step after lead form
                go(1);
              }}
            />
            {/* Default lead form warning removed */}
          </>
        ) : (
          <HotspotOverlay
            className="absolute inset-0 w-full h-full"
            imageUrl={resolvedSrc}
            hotspots={currentHotspots as any}
            onHotspotClick={() => go(1)}
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
        <div className="absolute right-3 bottom-6 z-40 pointer-events-auto" title="Powered by Propels">
          <div className="rounded-sm border border-border bg-white shadow-sm px-2 py-1 text-[10px] text-muted-foreground">
            Powered by{" "}
            <a href="https://propels.ai" target="_blank" rel="noreferrer" className="underline">
              Propels
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
