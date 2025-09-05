import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { listPublicDemoItems } from "@/lib/api/demos";
import HotspotOverlay from "@/components/HotspotOverlay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
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
    dotSize?: number;
    dotColor?: string;
    animation?: "none" | "pulse" | "breathe" | "fade";
    dotStrokePx?: number;
    dotStrokeColor?: string;
  }>;
};

export default function PublicDemoEmbed() {
  const { demoId } = useParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [leadStepIndex, setLeadStepIndex] = useState<number | null>(null);
  const [leadBg, setLeadBg] = useState<"white" | "black">("white");
  const [steps, setSteps] = useState<PublicStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hotspotStyleDefaults, setHotspotStyleDefaults] = useState<{
    dotSize: number;
    dotColor: string;
    dotStrokePx: number;
    dotStrokeColor: string;
    animation: "none" | "pulse" | "breathe" | "fade";
  }>({ dotSize: 12, dotColor: "#2563eb", dotStrokePx: 2, dotStrokeColor: "#ffffff", animation: "none" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!demoId) return;
      setLoading(true);
      setError(undefined);
      try {
        const items = await listPublicDemoItems(demoId);
        if (cancelled) return;
        const metadata = items.find((it: any) => it.itemSK === "METADATA");
        const lIdx = typeof metadata?.leadStepIndex === "number" ? metadata.leadStepIndex : null;
        setLeadStepIndex(lIdx);
        let lBg: "white" | "black" = "white";
        if (metadata?.leadConfig) {
          try {
            const cfg = typeof metadata.leadConfig === "string" ? JSON.parse(metadata.leadConfig) : metadata.leadConfig;
            if (cfg && typeof cfg.bg === "string") lBg = cfg.bg === "black" ? "black" : "white";
          } catch {}
        } else {
          lBg = metadata?.leadBg === "black" ? "black" : "white";
        }
        setLeadBg(lBg);
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
        setSteps(stepItems);
        setCurrentIndex(0);
      } catch (e: any) {
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

  let displayTotal = steps.length + (leadStepIndex !== null ? 1 : 0);
  const isLeadDisplayIndex = leadStepIndex !== null && currentIndex === leadStepIndex;
  const mapDisplayToReal = (di: number) => {
    if (leadStepIndex === null) return di;
    return di < leadStepIndex ? di : di - 1;
  };
  const currentRealIndex = isLeadDisplayIndex ? -1 : mapDisplayToReal(currentIndex);
  const current = currentRealIndex >= 0 ? steps[currentRealIndex] : undefined;

  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [naturalAspect, setNaturalAspect] = useState<string | null>(null);
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
        try {
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
          };
          img.src = imageSrc as string;
        } catch {}
        return;
      }
      try {
        const isPublicPrefixed = String(raw).startsWith("public/");
        const keyForStorage = isPublicPrefixed ? String(raw).replace(/^public\//, "") : String(raw);
        const { url } = await storageGetUrl({ key: keyForStorage, options: { accessLevel: "guest" as any } });
        if (!cancelled) {
          const u = url.toString();
          setResolvedSrc(u);
          try {
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
            };
            img.src = u;
          } catch {}
        }
        return;
      } catch (e) {}
      try {
        const bucket = (outputs as any)?.storage?.bucket;
        const region = (outputs as any)?.aws_region || (outputs as any)?.awsRegion || (outputs as any)?.region;
        if (bucket && region) {
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
          if (!cancelled) {
            setResolvedSrc(s3Url);
            try {
              const img = new Image();
              img.onload = () => {
                if (cancelled) return;
                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;
                if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
              };
              img.src = s3Url;
            } catch {}
          }
          return;
        }
      } catch {}
      if (!cancelled) {
        setResolvedSrc(raw);
        try {
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
          };
          img.src = raw as string;
        } catch {}
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [current, imageSrc]);

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
          <LeadCaptureOverlay bg={leadBg} />
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
