import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { DemoPreview } from "@/components/DemoPreview";
import { createLeadSubmissionPublic } from "@/lib/api/demos";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import StepsBar from "@/components/StepsBar";
import { usePublicDemo } from "@/features/public/hooks/usePublicDemo";
import { useImageResolver } from "@/features/public/hooks/useImageResolver";
import outputs from "../../../../amplify_outputs.json";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PublicStep = {
  itemSK: string;
  order?: number;
  s3Key?: string;
  thumbnailS3Key?: string;
  pageUrl?: string;
  hotspots?: Array<{
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
    xNorm?: number;
    yNorm?: number;
    tooltip?: string;
    targetStep?: number;
    // Styling (optional; if absent, we will apply defaults from METADATA.hotspotStyle)
    dotSize?: number;
    dotColor?: string;
    animation?: "none" | "pulse" | "breathe" | "fade";
    dotStrokePx?: number;
    dotStrokeColor?: string;
  }>;
};

export default function PublicDemoPlayer() {
  const { demoId } = useParams();
  const location = useLocation();
  const { loading, error, metaName, leadStepIndex, leadBg, leadConfig, steps, hotspotStyleDefaults } =
    usePublicDemo(demoId);
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    // Reset index when steps reload
    setCurrentIndex(0);
  }, [steps?.length]);

  // Prepare variables; will be finalized after computing effectiveLeadIndex
  let realStepsCount = steps.length;
  let displayTotal = steps.length;
  let isLeadDisplayIndex = false;
  let currentRealIndex = currentIndex;
  let current: PublicStep | undefined = steps[currentIndex];
  // Determine effective lead index first (supports ?leadAt override)
  const leadAtOverride = useMemo(() => {
    const p = new URLSearchParams(location.search).get("leadAt");
    if (!p) return null;
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n >= 1 ? n - 1 : null; // user-facing 1-based -> 0-based
  }, [location.search]);
  const effectiveLeadIndex = leadAtOverride ?? leadStepIndex;

  // Compute mapping using effectiveLeadIndex
  realStepsCount = steps.length;
  displayTotal = realStepsCount + (effectiveLeadIndex !== null ? 1 : 0);
  isLeadDisplayIndex = effectiveLeadIndex !== null && currentIndex === effectiveLeadIndex;
  const mapDisplayToReal = (di: number) => {
    if (effectiveLeadIndex === null) return di;
    return di < effectiveLeadIndex ? di : di - 1;
  };
  currentRealIndex = isLeadDisplayIndex ? -1 : mapDisplayToReal(currentIndex);
  current = currentRealIndex >= 0 ? steps[currentRealIndex] : undefined;

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
  const { resolvedSrc } = useImageResolver(current?.s3Key || current?.thumbnailS3Key, imageSrc, false, {
    bucket,
    region,
  });

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= displayTotal) return;
    setCurrentIndex(idx);
  };

  // (mapping moved above, effectiveLeadIndex already computed)

  const previewSteps = useMemo(
    () =>
      steps.map((s, i) => ({
        id: s.itemSK,
        imageUrl: i === currentRealIndex ? resolvedSrc : undefined,
        hotspots: (s.hotspots || []).map((h) => ({
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
        })) as any,
        pageUrl: s.pageUrl,
      })),
    [steps, currentRealIndex, resolvedSrc, hotspotStyleDefaults]
  );

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">{metaName || "Demo"}</h1>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border rounded"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded"
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex >= displayTotal - 1}
          >
            Next
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 flex items-center justify-center w-full">
        <div className="w-full max-w-[1280px]">
          {isLeadDisplayIndex ? (
            <div className="w-full aspect-[1280/800] bg-white border rounded-xl flex items-center justify-center relative overflow-hidden">
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
              />
              {/* Default lead form warning removed */}
            </div>
          ) : (
            <DemoPreview
              steps={previewSteps}
              currentIndex={currentRealIndex}
              onIndexChange={(realIdx) => {
                // Map underlying media index -> display index (insert lead index if needed)
                const di = effectiveLeadIndex !== null && realIdx >= effectiveLeadIndex ? realIdx + 1 : realIdx;
                setCurrentIndex(di);
              }}
              showNavigation={false}
              className="w-full"
            />
          )}
          <div className="w-full bg-white border text-[10px] text-gray-600 text-center py-1 mt-1 rounded-b-md">
            Powered by{" "}
            <a href="https://propels.ai" target="_blank" rel="noreferrer" className="underline">
              Propels
            </a>
          </div>
        </div>
      </div>

      <footer className="bg-gray-100 p-4 border-t">
        <div className="max-w-5xl mx-auto">
          <StepsBar
            total={displayTotal}
            current={currentIndex}
            onSelect={(idx) => goTo(idx)}
            leadIndex={effectiveLeadIndex}
            className="mx-auto"
          />
          <div className="sr-only">{`Step ${currentIndex + 1} of ${displayTotal}`}</div>
        </div>
      </footer>
    </div>
  );
}
