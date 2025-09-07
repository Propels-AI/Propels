import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { listPublicDemoItems } from "@/lib/api/demos";
import { DemoPreview } from "@/components/DemoPreview";
import { createLeadSubmissionPublic } from "@/lib/api/demos";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import StepsBar from "@/components/StepsBar";
import { getUrl as storageGetUrl } from "aws-amplify/storage";
import outputs from "../../../../amplify_outputs.json";

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
  const debug = useMemo(() => new URLSearchParams(location.search).get("debug") === "1", [location.search]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [metaName, setMetaName] = useState<string | undefined>();
  const [leadStepIndex, setLeadStepIndex] = useState<number | null>(null);
  const [leadBg, setLeadBg] = useState<"white" | "black">("white");
  const [leadConfig, setLeadConfig] = useState<any>(undefined);
  const [steps, setSteps] = useState<PublicStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsRaw, setItemsRaw] = useState<any[]>([]);
  const [hotspotStyleDefaults, setHotspotStyleDefaults] = useState<{
    dotSize: number;
    dotColor: string;
    dotStrokePx: number;
    dotStrokeColor: string;
    animation: "none" | "pulse" | "breathe" | "fade";
    tooltipBgColor?: string;
    tooltipTextColor?: string;
    tooltipTextSizePx?: number;
    tooltipOffsetXNorm?: number;
    tooltipOffsetYNorm?: number;
  }>({ dotSize: 12, dotColor: "#2563eb", dotStrokePx: 2, dotStrokeColor: "#ffffff", animation: "none" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!demoId) return;
      setLoading(true);
      setError(undefined);
      try {
        console.debug("[PublicDemoPlayer] loading items", { demoId });
        const items = await listPublicDemoItems(demoId);
        console.debug("[PublicDemoPlayer] items fetched", {
          count: Array.isArray(items) ? items.length : undefined,
          items,
        });
        if (cancelled) return;
        setItemsRaw(Array.isArray(items) ? items : []);
        const metadata = items.find((it: any) => it.itemSK === "METADATA");
        console.debug("[PublicDemoPlayer] metadata", metadata);
        setMetaName(metadata?.name);
        // Read lead config (public mirror)
        const lIdx = typeof metadata?.leadStepIndex === "number" ? metadata.leadStepIndex : null;
        setLeadStepIndex(lIdx);
        // Prefer flexible leadConfig.bg if available
        let lBg: "white" | "black" = "white";
        if (metadata?.leadConfig) {
          try {
            const cfgRaw = metadata.leadConfig;
            let cfg: any = typeof cfgRaw === "string" ? JSON.parse(cfgRaw) : cfgRaw;
            // Defensive: handle double-encoded JSON
            if (typeof cfg === "string") {
              try { cfg = JSON.parse(cfg); } catch {}
            }
            setLeadConfig(cfg);
            if (cfg && typeof cfg.bg === "string") {
              lBg = cfg.bg === "black" ? "black" : "white";
            }
          } catch {}
        } else {
          lBg = metadata?.leadBg === "black" ? "black" : "white";
        }
        setLeadBg(lBg);
        // Read hotspot style defaults from METADATA
        try {
          const rawStyle = metadata?.hotspotStyle;
          if (rawStyle) {
            const parsed = typeof rawStyle === "string" ? JSON.parse(rawStyle) : rawStyle;
            if (parsed && typeof parsed === "object") {
              setHotspotStyleDefaults({
                dotSize: Number(parsed.dotSize ?? 12),
                dotColor: String(parsed.dotColor ?? "#2563eb"),
                dotStrokePx: Number(parsed.dotStrokePx ?? 2),
                dotStrokeColor: String(parsed.dotStrokeColor ?? "#ffffff"),
                animation: (parsed.animation ?? "none") as any,
                tooltipBgColor: parsed.tooltipBgColor,
                tooltipTextColor: parsed.tooltipTextColor,
                tooltipTextSizePx: parsed.tooltipTextSizePx,
                tooltipOffsetXNorm: parsed.tooltipOffsetXNorm,
                tooltipOffsetYNorm: parsed.tooltipOffsetYNorm,
              });
            }
          }
        } catch {}

        const stepItems: PublicStep[] = items
          .filter((it: any) => typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"))
          .map((it: any) => ({
            itemSK: it.itemSK,
            order: it.order,
            s3Key: it.s3Key,
            thumbnailS3Key: it.thumbnailS3Key,
            pageUrl: it.pageUrl,
            hotspots: it.hotspots ?? [],
          }));
        stepItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        console.debug("[PublicDemoPlayer] steps parsed", stepItems);
        setSteps(stepItems);
        setCurrentIndex(0);
      } catch (e: any) {
        console.error("[PublicDemoPlayer] load error", e);
        setError(e?.message || "Failed to load demo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [demoId]);

  // These depend on effectiveLeadIndex (declared below)
  let realStepsCount = steps.length;
  let displayTotal = steps.length; // initialize; will recompute after effectiveLeadIndex
  let isLeadDisplayIndex = false;
  let currentRealIndex = currentIndex;
  let current: PublicStep | undefined = steps[currentIndex];

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
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

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const raw = current?.s3Key || current?.thumbnailS3Key;
      const hasDirect = typeof imageSrc === "string" && imageSrc.length > 0;
      if (!raw) {
        setResolvedSrc(undefined);
        return;
      }
      if (hasDirect) {
        setResolvedSrc(imageSrc);
        return;
      }
      try {
        const isPublicPrefixed = String(raw).startsWith("public/");
        const keyForStorage = isPublicPrefixed ? String(raw).replace(/^public\//, "") : String(raw);
        const { url } = await storageGetUrl({ key: keyForStorage, options: { accessLevel: "guest" as any } });
        if (!cancelled) setResolvedSrc(url.toString());
        console.debug("[PublicDemoPlayer] resolved via Storage.getUrl", { raw, keyForStorage, url: url.toString() });
        return;
      } catch (e) {
        console.warn("[PublicDemoPlayer] Storage.getUrl failed; will attempt direct S3 URL", e);
      }
      try {
        const bucket = (outputs as any)?.storage?.bucket;
        const region = (outputs as any)?.aws_region || (outputs as any)?.awsRegion || (outputs as any)?.region;
        if (bucket && region) {
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
          if (!cancelled) setResolvedSrc(s3Url);
          console.debug("[PublicDemoPlayer] resolved via direct S3 URL", { raw, s3Url });
          return;
        }
      } catch {}
      if (!cancelled) setResolvedSrc(raw);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [current, imageSrc]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= displayTotal) return;
    setCurrentIndex(idx);
  };

  // leadAt URL override for testing
  const leadAtOverride = useMemo(() => {
    const p = new URLSearchParams(location.search).get("leadAt");
    if (!p) return null;
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n >= 1 ? n - 1 : null; // user-facing 1-based -> 0-based
  }, [location.search]);
  const effectiveLeadIndex = leadAtOverride ?? leadStepIndex;

  // Now that effectiveLeadIndex is available, compute display mapping
  realStepsCount = steps.length;
  displayTotal = realStepsCount + (effectiveLeadIndex !== null ? 1 : 0);
  isLeadDisplayIndex = effectiveLeadIndex !== null && currentIndex === effectiveLeadIndex;
  const mapDisplayToReal = (di: number) => {
    if (effectiveLeadIndex === null) return di;
    return di < effectiveLeadIndex ? di : di - 1;
  };
  currentRealIndex = isLeadDisplayIndex ? -1 : mapDisplayToReal(currentIndex);
  current = currentRealIndex >= 0 ? steps[currentRealIndex] : undefined;

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

  if (!demoId) return <div className="p-6">Missing demoId</div>;
  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (displayTotal === 0)
    return (
      <div className="p-6 space-y-4">
        <div>No steps available</div>
        {(debug || true) && (
          <pre className="text-xs whitespace-pre-wrap bg-gray-50 border p-3 rounded">
            {`Debug:
demoId: ${demoId}
items.count: ${itemsRaw.length}
items.sampleKeys: ${itemsRaw
              .map((i) => i?.itemSK)
              .slice(0, 10)
              .join(", ")}
error: ${error ?? "<none>"}
`}
          </pre>
        )}
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
        {isLeadDisplayIndex ? (
          <div className="w-full max-w-[1280px] aspect-[1280/800] bg-white border rounded-xl flex items-center justify-center relative overflow-hidden">
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
            {!Array.isArray((leadConfig as any)?.fields) && (
              <div className="absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 shadow">
                Showing default lead form (no fields in config)
              </div>
            )}
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
        {debug && (
          <div className="max-w-5xl mx-auto mt-2">
            <pre className="text-xs whitespace-pre-wrap bg-gray-50 border p-3 rounded overflow-auto">
              {`Debug:
demoId: ${demoId}
metaName: ${metaName}
realStepsCount: ${realStepsCount}
displayTotal: ${displayTotal}
currentIndex: ${currentIndex}
current.itemSK: ${current?.itemSK}
imageSrc: ${imageSrc}
resolvedSrc: ${resolvedSrc}
`}
            </pre>
          </div>
        )}
      </footer>
    </div>
  );
}
