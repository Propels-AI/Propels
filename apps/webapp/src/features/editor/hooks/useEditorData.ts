import { useEffect, useRef, useState } from "react";
import { listDemoItems } from "@/lib/api/demos";
import { resolveScreenshotUrl } from "@/features/editor/services/storage";
import {
  deriveTooltipStyleFromHotspots,
  type HotspotsMap,
  type TooltipStyle,
} from "@/lib/editor/deriveTooltipStyleFromHotspots";

export type EditorHotspot = {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  xNorm?: number;
  yNorm?: number;
  tooltip?: string;
  dotSize?: number;
  dotColor?: string;
  animation?: "none" | "pulse" | "breathe" | "fade";
  dotStrokePx?: number;
  dotStrokeColor?: string;
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  tooltipTextSizePx?: number;
};

export type EditorStep = {
  id: string;
  pageUrl: string;
  screenshotUrl?: string;
  s3Key?: string;
  thumbnailS3Key?: string;
  isLeadCapture?: boolean;
  leadBg?: "white" | "black";
};

export function useEditorData(demoId?: string) {
  const [loading, setLoading] = useState(false);
  const [demoName, setDemoName] = useState<string>("");
  const [demoStatus, setDemoStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [steps, setSteps] = useState<EditorStep[]>([]);
  const [hotspotsByStep, setHotspotsByStep] = useState<Record<string, EditorHotspot[]>>({});
  const [leadFormConfig, setLeadFormConfig] = useState<any>(undefined);
  const [tooltipStyle, setTooltipStyle] = useState<TooltipStyle>({
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
    tooltipBgColor: "#2563eb",
    tooltipTextColor: "#ffffff",
    tooltipTextSizePx: 12,
  });

  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!demoId) return;
    const id: string = demoId; // narrow after guard
    let cancelled = false;
    attemptsRef.current = 0;

    async function load() {
      try {
        setLoading(true);
        const items = await listDemoItems(id);
        if (cancelled) return;
        const meta = (items || []).find((it: any) => String(it.itemSK) === "METADATA");
        if (meta) {
          setDemoName(meta.name || "");
          setDemoStatus((meta.status as any) === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
          // lead config
          try {
            if ((meta as any).leadConfig) {
              const cfg =
                typeof (meta as any).leadConfig === "string"
                  ? JSON.parse((meta as any).leadConfig)
                  : (meta as any).leadConfig;
              if (cfg && typeof cfg === "object") setLeadFormConfig(cfg);
            }
          } catch {}
          // tooltip style
          try {
            const raw = (meta as any).hotspotStyle;
            if (raw) {
              const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (parsed && typeof parsed === "object") {
                setTooltipStyle((prev) => ({
                  dotSize: Number(parsed.dotSize ?? prev.dotSize ?? 12),
                  dotColor: String(parsed.dotColor ?? prev.dotColor ?? "#2563eb"),
                  dotStrokePx: Number(parsed.dotStrokePx ?? prev.dotStrokePx ?? 2),
                  dotStrokeColor: String(parsed.dotStrokeColor ?? prev.dotStrokeColor ?? "#ffffff"),
                  animation: (parsed.animation ?? prev.animation ?? "none") as any,
                  tooltipBgColor: String(parsed.tooltipBgColor ?? prev.tooltipBgColor ?? "#2563eb"),
                  tooltipTextColor: String(parsed.tooltipTextColor ?? prev.tooltipTextColor ?? "#ffffff"),
                  tooltipTextSizePx: Number(parsed.tooltipTextSizePx ?? prev.tooltipTextSizePx ?? 12),
                }));
              }
            }
          } catch {}
        }

        const stepItems = (items || []).filter((it: any) => String(it.itemSK || "").startsWith("STEP#"));
        stepItems.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        const urls: EditorStep[] = [];
        const hotspotsMap: Record<string, EditorHotspot[]> = {};

        for (const si of stepItems) {
          try {
            const raw: string | undefined = si.s3Key;
            if (!raw) continue;
            const screenshotUrl = await resolveScreenshotUrl(raw as string);
            if (!screenshotUrl) continue;
            urls.push({
              id: String(si.itemSK).slice("STEP#".length),
              pageUrl: si.pageUrl || "",
              screenshotUrl,
              s3Key: si.s3Key,
              thumbnailS3Key: si.thumbnailS3Key,
            });
            if (si.hotspots) {
              try {
                const parsed = typeof si.hotspots === "string" ? JSON.parse(si.hotspots) : si.hotspots;
                if (Array.isArray(parsed))
                  hotspotsMap[String(si.itemSK).slice("STEP#".length)] = parsed as EditorHotspot[];
              } catch {}
            }
          } catch (e) {
            console.error("[useEditorData] Failed to resolve S3 URL", { itemSK: si?.itemSK, s3Key: si?.s3Key }, e);
          }
        }

        // Retry when backend eventual consistency yields zero data
        if (!stepItems.length && attemptsRef.current < 10) {
          attemptsRef.current += 1;
          const delayMs = 300 + attemptsRef.current * 300;
          timerRef.current = setTimeout(load, delayMs);
          return;
        }
        if (stepItems.length > 0 && !urls.length && attemptsRef.current < 10) {
          attemptsRef.current += 1;
          const delayMs = 500 + attemptsRef.current * 400;
          timerRef.current = setTimeout(load, delayMs);
          return;
        }

        // Derive tooltip style defaults from hotspots if not present in meta
        try {
          const hasMetaStyle = Boolean((meta as any)?.hotspotStyle);
          if (!hasMetaStyle) {
            const derived = deriveTooltipStyleFromHotspots(hotspotsMap as HotspotsMap, tooltipStyle as TooltipStyle);
            if (derived) setTooltipStyle((prev) => ({ ...prev, ...derived }));
          }
        } catch {}

        // Insert lead step placeholder at saved position
        try {
          let leadIdxSaved: number | null | undefined = (meta as any)?.leadStepIndex;
          let leadBgSaved: "white" | "black" = "white";
          if ((meta as any)?.leadConfig) {
            try {
              const cfg =
                typeof (meta as any).leadConfig === "string"
                  ? JSON.parse((meta as any).leadConfig)
                  : (meta as any).leadConfig;
              if (cfg && (cfg.bg === "white" || cfg.bg === "black")) leadBgSaved = cfg.bg;
            } catch {}
          }
          if (typeof leadIdxSaved === "number" && leadIdxSaved >= 0 && leadIdxSaved <= urls.length) {
            const leadStep = {
              id: "LEAD-SAVED",
              pageUrl: "",
              isLeadCapture: true as const,
              leadBg: leadBgSaved,
            } as any;
            urls.splice(leadIdxSaved, 0, leadStep);
          }
        } catch {}

        setSteps(urls);
        setHotspotsByStep(hotspotsMap);
      } catch (e) {
        console.error("[useEditorData] Failed to load demo from backend", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [demoId]);

  return {
    loading,
    demoName,
    demoStatus,
    steps,
    hotspotsByStep,
    leadFormConfig,
    tooltipStyle,
  } as const;
}
