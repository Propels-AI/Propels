import { useEffect, useState } from "react";
import { listPublicDemoItems, listDemoItems } from "@/lib/api/demos";

export type PublicStep = {
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

export type HotspotStyleDefaults = {
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
};

export function usePublicDemo(demoId?: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [metaName, setMetaName] = useState<string | undefined>();
  const [leadStepIndex, setLeadStepIndex] = useState<number | null>(null);
  const [leadBg, setLeadBg] = useState<"white" | "black">("white");
  const [leadConfig, setLeadConfig] = useState<any>(undefined);
  const [steps, setSteps] = useState<PublicStep[]>([]);
  const [hotspotStyleDefaults, setHotspotStyleDefaults] = useState<HotspotStyleDefaults>({
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
  });

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
        setMetaName(metadata?.name);
        const lIdx = typeof metadata?.leadStepIndex === "number" ? metadata.leadStepIndex : null;
        setLeadStepIndex(lIdx);
        // lead config + bg
        let lBg: "white" | "black" = "white";
        if (metadata?.leadConfig) {
          try {
            const cfgRaw = metadata.leadConfig;
            let cfg: any = typeof cfgRaw === "string" ? JSON.parse(cfgRaw) : cfgRaw;
            if (typeof cfg === "string") {
              try { cfg = JSON.parse(cfg); } catch {}
            }
            setLeadConfig(cfg);
            if (cfg && typeof cfg.bg === "string") lBg = cfg.bg === "black" ? "black" : "white";
          } catch {}
        } else {
          lBg = metadata?.leadBg === "black" ? "black" : "white";
        }
        setLeadBg(lBg);
        // Fallback to private leadConfig when public lacks fields
        try {
          if (!Array.isArray((metadata?.leadConfig as any)?.fields)) {
            const privateItems = await listDemoItems(demoId);
            const privateMeta = (privateItems || []).find((it: any) => it.itemSK === "METADATA");
            let cfg: any = privateMeta?.leadConfig;
            if (cfg) {
              try { cfg = typeof cfg === "string" ? JSON.parse(cfg) : cfg; } catch {}
              if (typeof cfg === "string") { try { cfg = JSON.parse(cfg); } catch {} }
              if (cfg && Array.isArray(cfg.fields)) {
                setLeadConfig((prev: any) => (prev && Array.isArray(prev.fields) ? prev : cfg));
                if (cfg.bg === "black" || cfg.bg === "white") setLeadBg(cfg.bg);
              }
            }
          }
        } catch {}
        // hotspot style defaults
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
        // steps
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

  return {
    loading,
    error,
    metaName,
    leadStepIndex,
    leadBg,
    leadConfig,
    steps,
    hotspotStyleDefaults,
  } as const;
}
