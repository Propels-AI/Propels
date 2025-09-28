import { useEffect, useState } from "react";
import { listPublicDemoItems, listPrivateDemoItemsPublic } from "@/lib/api/demos";

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
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!demoId) return;
      setLoading(true);
      setError(undefined);
      try {
        // Load public mirror
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
              try {
                cfg = JSON.parse(cfg);
              } catch {}
            }
            setLeadConfig(cfg);
            if (cfg && typeof cfg.bg === "string") lBg = cfg.bg === "black" ? "black" : "white";
          } catch {}
        } else {
          lBg = metadata?.leadBg === "black" ? "black" : "white";
        }
        setLeadBg(lBg);

        // Also load private METADATA (public-readable) to support DRAFT previews
        const privateItems = await listPrivateDemoItemsPublic(demoId);
        const privateMeta = (privateItems || []).find((it: any) => it.itemSK === "METADATA");
        let privateCfg: any = privateMeta?.leadConfig;
        try {
          privateCfg = typeof privateCfg === "string" ? JSON.parse(privateCfg) : privateCfg;
        } catch {}
        if (typeof privateCfg === "string") {
          try {
            privateCfg = JSON.parse(privateCfg);
          } catch {}
        }
        const privateFields = Array.isArray(privateCfg?.fields) ? privateCfg.fields : [];
        const isDraft = String(privateMeta?.status || "DRAFT").toUpperCase() !== "PUBLISHED";
        // If still DRAFT and private has a richer config, prefer it (for editor previews before publish)
        if (isDraft && privateFields.length > 0) {
          setLeadConfig(privateCfg);
          if (privateCfg.bg === "black" || privateCfg.bg === "white") setLeadBg(privateCfg.bg as any);
          if (typeof privateMeta?.leadStepIndex === "number") setLeadStepIndex(privateMeta.leadStepIndex);
        }
        // Prefer private leadConfig when it's richer/newer than public (handles mirror lag/defaults)
        try {
          const pubCfgRaw: any = metadata?.leadConfig;
          let pubCfg: any = typeof pubCfgRaw === "string" ? JSON.parse(pubCfgRaw) : pubCfgRaw;
          if (typeof pubCfg === "string") {
            try {
              pubCfg = JSON.parse(pubCfg);
            } catch {}
          }
          const publicFields = Array.isArray(pubCfg?.fields) ? pubCfg.fields : [];
          const looksDefault =
            pubCfg &&
            typeof pubCfg === "object" &&
            (pubCfg.title === "Stay in the loop" ||
              pubCfg.subtitle === "Enjoying the demo? Leave your details and we’ll reach out." ||
              (publicFields.length === 1 && publicFields[0]?.key === "email"));

          // privateMeta/privateCfg already loaded above; clone into local var
          let pCfg: any = privateCfg;
          if (pCfg) {
            try {
              pCfg = typeof pCfg === "string" ? JSON.parse(pCfg) : pCfg;
            } catch {}
            if (typeof pCfg === "string") {
              try {
                pCfg = JSON.parse(pCfg);
              } catch {}
            }
          }
          const privateFields = Array.isArray(pCfg?.fields) ? pCfg.fields : [];
          const differs = (() => {
            try {
              return JSON.stringify(pCfg || {}) !== JSON.stringify(pubCfg || {});
            } catch {
              return false;
            }
          })();
          const shouldUsePrivate = privateFields.length > 0 && (looksDefault || publicFields.length === 0 || differs);
          if (shouldUsePrivate) {
            setLeadConfig(pCfg);
            if (pCfg.bg === "black" || pCfg.bg === "white") setLeadBg(pCfg.bg as any);
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
  }, [demoId, refreshTick]);

  // Debounce and avoid refreshing during active user interaction
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastUserActivity = Date.now();

    const updateActivity = () => {
      lastUserActivity = Date.now();
    };

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      
      // Calculate remaining time until inactivity window elapses
      const inactivityWindow = 3000; // 3 seconds
      const timeSinceActivity = Date.now() - lastUserActivity;
      const remainingDelay = Math.max(inactivityWindow - timeSinceActivity, 100); // minimum 100ms
      
      debounceTimer = setTimeout(() => {
        // Double-check user hasn't been active since we scheduled this
        if (Date.now() - lastUserActivity >= inactivityWindow) {
          setRefreshTick((t) => t + 1);
        }
      }, remainingDelay);
    };

    const onFocus = () => {
      updateActivity();
      debouncedRefresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        updateActivity();
        debouncedRefresh();
      }
    };

    // Track user activity to avoid refreshing during interaction
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
