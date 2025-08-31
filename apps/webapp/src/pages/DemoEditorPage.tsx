import React, { useEffect, useState, useRef } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { Input } from "@/components/ui/input";
import { syncAnonymousDemo, type EditedDraft } from "../lib/services/syncAnonymousDemo";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useSearchParams } from "react-router-dom";
import {
  deleteDemo,
  listDemoItems,
  renameDemo,
  setDemoStatus,
  updateDemoStepHotspots,
  mirrorDemoToPublic,
  updateDemoLeadConfig,
  updateDemoStyleConfig,
} from "@/lib/api/demos";
import { getUrl } from "aws-amplify/storage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import HotspotOverlay from "@/components/HotspotOverlay";

export function DemoEditorPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user?.userId || !!user?.username;
  const [searchParams] = useSearchParams();
  const demoIdParam = searchParams.get("demoId") || searchParams.get("demoid") || undefined;
  const [loadingSteps, setLoadingSteps] = useState<boolean>(false);
  const [steps, setSteps] = useState<
    Array<{
      id: string;
      pageUrl: string;
      screenshotUrl?: string;
      xNorm?: number;
      yNorm?: number;
      clickX?: number;
      clickY?: number;
      viewportWidth?: number;
      viewportHeight?: number;
      // Lead capture step flags
      isLeadCapture?: boolean;
      leadBg?: "white" | "black";
    }>
  >([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  // Lead step quick-insert MVP controls
  const [leadUiOpen, setLeadUiOpen] = useState(false);
  const [leadInsertPos, setLeadInsertPos] = useState<"before" | "after">("after");
  const [leadInsertAnchor, setLeadInsertAnchor] = useState<number>(1); // 1-based for UI
  const [authOpen, setAuthOpen] = useState(false);
  const pendingDraftRef = useRef<EditedDraft | null>(null);
  // Metadata for saved demo (when demoId exists)
  const [demoName, setDemoName] = useState<string>("");
  const [demoStatus, setDemoStatusLocal] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [savingTitle, setSavingTitle] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingDemo, setSavingDemo] = useState(false);
  // Retry counter for backend load (handle eventual consistency right after creation)
  const loadAttemptsRef = useRef<number>(0);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  // Drag state for moving existing hotspot (tooltip dot)
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);
  const [dragHotspotId, setDragHotspotId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  type Hotspot = {
    id: string;
    x?: number;
    y?: number;
    width: number;
    height: number;
    xNorm?: number;
    yNorm?: number;
    tooltip?: string;
    // Styling fields
    dotSize?: number; // px
    dotColor?: string; // e.g., #2563eb
    animation?: "none" | "pulse" | "breathe" | "fade";
    dotStrokePx?: number; // border width in px
    dotStrokeColor?: string; // border color
  };

  const [hotspotsByStep, setHotspotsByStep] = useState<Record<string, Hotspot[]>>({});
  const [editingTooltip, setEditingTooltip] = useState<string | null>(null);
  const [tooltipText, setTooltipText] = useState("");
  const [inspectorTab, setInspectorTab] = useState<'fill' | 'stroke'>("fill");
  // Global tooltip style for consistency across all steps
  const [tooltipStyle, setTooltipStyle] = useState<{ dotSize: number; dotColor: string; dotStrokePx: number; dotStrokeColor: string; animation: "none" | "pulse" | "breathe" | "fade" }>({
    dotSize: 12,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "none",
  });
  const imageRef = useRef<HTMLDivElement>(null);
  const computeRenderRect = (containerW: number, containerH: number, naturalW: number, naturalH: number) => {
    if (naturalW <= 0 || naturalH <= 0 || containerW <= 0 || containerH <= 0) {
      return { x: 0, y: 0, w: containerW, h: containerH };
    }
    const scale = Math.min(containerW / naturalW, containerH / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    const x = (containerW - w) / 2;
    const y = (containerH - h) / 2;
    return { x, y, w, h };
  };
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const isCurrentLeadStep = Boolean(steps[selectedStepIndex]?.isLeadCapture);
  // Keep canvas size consistent on lead steps: use last known naturalSize or a sane default
  const effectiveNaturalSize = isCurrentLeadStep && !naturalSize ? { w: 1280, h: 800 } : naturalSize;

  const currentStepId = steps[selectedStepIndex]?.id;
  const currentHotspots: Hotspot[] = currentStepId ? (hotspotsByStep[currentStepId] ?? []) : [];

  useEffect(() => {
    console.log("[Editor] mounted", { demoIdParam, isAuthenticated });
  }, [demoIdParam, isAuthenticated]);

  useEffect(() => {
    const url = steps[selectedStepIndex]?.screenshotUrl;
    if (!url) {
      setNaturalSize(null);
      return;
    }
    setNaturalSize(null);
    setImageLoading(true);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageLoading(false);
    };
    img.onerror = () => {
      setNaturalSize(null);
      setImageLoading(false);
    };
    img.src = url;
  }, [steps, selectedStepIndex]);

  useEffect(() => {
    const loadFromBackend = async (demoId: string) => {
      try {
        // Keep loading state true across retries to avoid flashing 0 steps UI
        setLoadingSteps(true);
        console.log("[Editor] Loading demo from backend", { demoId });
        // Ensure auth session is ready so Data and Storage calls have credentials
        try {
          const { fetchAuthSession } = await import("aws-amplify/auth");
          await fetchAuthSession();
        } catch (e) {
          console.warn("[Editor] fetchAuthSession failed (continuing)", e);
        }
        const items = await listDemoItems(demoId);
        console.log("[Editor] listDemoItems returned", { count: items?.length, items });
        const meta = (items || []).find((it: any) => String(it.itemSK) === "METADATA");
        if (meta) {
          setDemoName(meta.name || "");
          setDemoStatusLocal((meta.status as any) === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
          // Restore saved hotspot styling if present
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
                }));
              }
            }
          } catch {}
        }
        const stepItems = (items || []).filter((it: any) => String(it.itemSK || "").startsWith("STEP#"));
        stepItems.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        console.log("[Editor] stepItems", { count: stepItems.length, stepItems });
        // If no steps yet, retry a few times (eventual consistency after creation)
        if (!stepItems.length && loadAttemptsRef.current < 10) {
          loadAttemptsRef.current += 1;
          const delayMs = 300 + loadAttemptsRef.current * 300; // ~0.6s..3.3s
          console.log("[Editor] No steps found; retrying load in", delayMs, "ms (attempt", loadAttemptsRef.current, ")");
          setTimeout(() => {
            // fire and forget; effect guard handles demoId match
            loadFromBackend(demoId);
          }, delayMs);
          return; // don't proceed to set empty state yet
        }
        // If steps exist but required fields like s3Key are null (likely due to public read without owner auth), retry
        const haveAnyS3 = stepItems.some((it: any) => !!it?.s3Key);
        if (stepItems.length > 0 && !haveAnyS3 && loadAttemptsRef.current < 10) {
          loadAttemptsRef.current += 1;
          const delayMs = 400 + loadAttemptsRef.current * 400; // ~0.8s..4.4s
          console.log(
            "[Editor] Steps found but fields are null (awaiting auth/consistency); retrying in",
            delayMs,
            "ms (attempt",
            loadAttemptsRef.current,
            ")"
          );
          setTimeout(() => loadFromBackend(demoId), delayMs);
          return;
        }
        const urls: Array<{
          id: string;
          pageUrl: string;
          screenshotUrl: string;
        }> = [];
        const hotspotsMap: Record<string, Hotspot[]> = {};
        for (const si of stepItems) {
          try {
            const raw: string | undefined = si.s3Key;
            if (!raw) continue;
            const isUrl = /^(https?:)?\/\//i.test(raw);
            let screenshotUrl: string | undefined;
            if (isUrl) {
              screenshotUrl = raw;
            } else {
              const s = String(raw);
              let access: "guest" | "protected" | "private" = "guest";
              let keyForStorage = s;
              if (s.startsWith("public/")) {
                access = "guest";
                keyForStorage = s.replace(/^public\//, "");
              } else if (s.startsWith("protected/")) {
                access = "protected";
                keyForStorage = s.replace(/^protected\/[^/]+\//, "");
              } else if (s.startsWith("private/")) {
                access = "private";
                keyForStorage = s.replace(/^private\/[^/]+\//, "");
              }
              try {
                const { url } = await getUrl({ key: keyForStorage, options: { accessLevel: access as any } } as any);
                screenshotUrl = url.toString();
              } catch (err) {
                console.warn("[Editor] Storage.getUrl failed", { raw, keyForStorage, access }, err);
              }
            }
            if (!screenshotUrl) continue;
            urls.push({
              id: String(si.itemSK).slice("STEP#".length),
              pageUrl: si.pageUrl || "",
              screenshotUrl,
            });
            if (si.hotspots) {
              try {
                const parsed = typeof si.hotspots === "string" ? JSON.parse(si.hotspots) : si.hotspots;
                if (Array.isArray(parsed)) hotspotsMap[String(si.itemSK).slice("STEP#".length)] = parsed as Hotspot[];
              } catch (_e) {}
            }
          } catch (e) {
            console.error("[Editor] Failed to resolve S3 URL", { itemSK: si?.itemSK, s3Key: si?.s3Key }, e);
          }
        }
        // If steps exist but we couldn't resolve any screenshot URLs yet, retry
        if (stepItems.length > 0 && urls.length === 0 && loadAttemptsRef.current < 10) {
          loadAttemptsRef.current += 1;
          const delayMs = 500 + loadAttemptsRef.current * 400;
          console.log(
            "[Editor] Steps present but screenshots unresolved; retrying in",
            delayMs,
            "ms (attempt",
            loadAttemptsRef.current,
            ")"
          );
          setTimeout(() => loadFromBackend(demoId), delayMs);
          return;
        }
        // If metadata did not include hotspotStyle, derive defaults from first hotspot present
        try {
          const hasMetaStyle = Boolean((meta as any)?.hotspotStyle);
          if (!hasMetaStyle) {
            let derived: any = null;
            for (const list of Object.values(hotspotsMap)) {
              if (Array.isArray(list) && list.length > 0) {
                const h = list[0] as any;
                derived = {
                  dotSize: Number(h?.dotSize ?? 12),
                  dotColor: String(h?.dotColor ?? "#2563eb"),
                  dotStrokePx: Number(h?.dotStrokePx ?? 2),
                  dotStrokeColor: String(h?.dotStrokeColor ?? "#ffffff"),
                  animation: (h?.animation ?? "none") as any,
                };
                break;
              }
            }
            if (derived) {
              setTooltipStyle((prev) => ({
                dotSize: Number(derived.dotSize ?? prev.dotSize ?? 12),
                dotColor: String(derived.dotColor ?? prev.dotColor ?? "#2563eb"),
                dotStrokePx: Number(derived.dotStrokePx ?? prev.dotStrokePx ?? 2),
                dotStrokeColor: String(derived.dotStrokeColor ?? prev.dotStrokeColor ?? "#ffffff"),
                animation: (derived.animation ?? prev.animation ?? "none") as any,
              }));
            }
          }
        } catch {}

        // Insert saved lead-capture step from METADATA if present
        try {
          let leadIdxSaved: number | null | undefined = (meta as any)?.leadStepIndex;
          let leadBgSaved: 'white' | 'black' = 'white';
          if ((meta as any)?.leadConfig) {
            try {
              const cfg = typeof (meta as any).leadConfig === 'string' ? JSON.parse((meta as any).leadConfig) : (meta as any).leadConfig;
              if (cfg && (cfg.bg === 'white' || cfg.bg === 'black')) leadBgSaved = cfg.bg;
            } catch {}
          }
          if (typeof leadIdxSaved === 'number' && leadIdxSaved >= 0 && leadIdxSaved <= urls.length) {
            const leadStep = {
              id: 'LEAD-SAVED',
              pageUrl: '',
              screenshotUrl: undefined as unknown as string,
              isLeadCapture: true as const,
              leadBg: leadBgSaved,
            } as any;
            urls.splice(leadIdxSaved, 0, leadStep);
          }
        } catch {}

        setSteps(urls);
        setHotspotsByStep(hotspotsMap);
        setSelectedStepIndex(0);
      } catch (e) {
        console.error("[Editor] Failed to load demo from backend", e);
      } finally {
        // We only reach finally when not returning early (i.e., not retrying). Clear loading.
        setLoadingSteps(false);
      }
    };

    const loadFromExtension = async () => {
      try {
        setLoadingSteps(true);
        const extId = (import.meta as any).env?.VITE_CHROME_EXTENSION_ID || "";
        if (typeof chrome !== "undefined" && chrome.runtime && extId) {
          const response = await chrome.runtime.sendMessage(extId, {
            type: "GET_CAPTURE_SESSION",
          });
          console.log("[Editor] GET_CAPTURE_SESSION response:", response);
          if (response?.success && Array.isArray(response.data)) {
            const sorted = [...response.data].sort((a: any, b: any) => {
              const so = (a.stepOrder ?? 0) - (b.stepOrder ?? 0);
              return so !== 0 ? so : (a.timestamp ?? 0) - (b.timestamp ?? 0);
            });

            const urls: Array<{
              id: string;
              pageUrl: string;
              screenshotUrl: string;
              xNorm?: number;
              yNorm?: number;
              clickX?: number;
              clickY?: number;
              viewportWidth?: number;
              viewportHeight?: number;
            }> = [];
            for (const d of sorted) {
              try {
                let url = d.screenshotDataUrl as string | undefined;
                if (!url && d.screenshotBlob) {
                  const blob: Blob = d.screenshotBlob as Blob;
                  url = URL.createObjectURL(blob);
                }
                if (!url) continue;
                urls.push({
                  id: d.id,
                  pageUrl: d.pageUrl,
                  screenshotUrl: url,
                  xNorm: (d as any).xNorm,
                  yNorm: (d as any).yNorm,
                  clickX: (d as any).clickX,
                  clickY: (d as any).clickY,
                  viewportWidth: (d as any).viewportWidth,
                  viewportHeight: (d as any).viewportHeight,
                });
              } catch (_e) {}
            }
            setSteps(urls);
            setSelectedStepIndex(0);
            (async () => {
              try {
                const DEFAULT_W = 12;
                const DEFAULT_H = 12;

                const initial: Record<string, Hotspot[]> = {};

                await Promise.all(
                  urls.map(
                    (s) =>
                      new Promise<void>((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                          let xNorm: number | undefined = typeof s.xNorm === "number" ? s.xNorm : undefined;
                          let yNorm: number | undefined = typeof s.yNorm === "number" ? s.yNorm : undefined;
                          if (
                            (xNorm === undefined || yNorm === undefined) &&
                            typeof s.clickX === "number" &&
                            typeof s.clickY === "number" &&
                            typeof s.viewportWidth === "number" &&
                            typeof s.viewportHeight === "number" &&
                            s.viewportWidth > 0 &&
                            s.viewportHeight > 0
                          ) {
                            xNorm = s.clickX / s.viewportWidth;
                            yNorm = s.clickY / s.viewportHeight;
                          }

                          if (xNorm === undefined || yNorm === undefined || isNaN(xNorm) || isNaN(yNorm)) {
                            resolve();
                            return;
                          }

                          const hotspot: Hotspot = {
                            id: Math.random().toString(36).slice(2, 9),
                            xNorm,
                            yNorm,
                            width: DEFAULT_W,
                            height: DEFAULT_H,
                            tooltip: "",
                            dotSize: tooltipStyle.dotSize,
                            dotColor: tooltipStyle.dotColor,
                            dotStrokePx: tooltipStyle.dotStrokePx,
                            dotStrokeColor: tooltipStyle.dotStrokeColor,
                            animation: tooltipStyle.animation,
                          };
                          initial[s.id] = [hotspot];
                          resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = s.screenshotUrl;
                      })
                  )
                );

                setHotspotsByStep(initial);
              } catch (_e) {
                // ignore
              }
            })();
          }
        }
      } catch (err) {
        console.log("No extension data available", err);
      }
    };

    // Reset attempts when demoId changes
    loadAttemptsRef.current = 0;
    if (demoIdParam) {
      loadFromBackend(demoIdParam);
    } else {
      loadFromExtension();
    }
  }, [demoIdParam]);

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerSize({ w: r.width, h: r.height });
    };
    measure();
    let ro: ResizeObserver | undefined;
    try {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    } catch {}
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [selectedStepIndex, naturalSize]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawing(false);
        setEditingTooltip(null);
        setIsPreviewing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Apply global style changes to all hotspots across all steps
  const applyGlobalStyle = (patch: Partial<{ dotSize: number; dotColor: string; dotStrokePx: number; dotStrokeColor: string; animation: "none" | "pulse" | "breathe" | "fade" }>) => {
    setTooltipStyle((prev) => ({ ...prev, ...patch }));
    setHotspotsByStep((prev) => {
      const next: typeof prev = {} as any;
      for (const [stepId, list] of Object.entries(prev)) {
        next[stepId] = (list || []).map((h) => ({
          ...h,
          dotSize: typeof patch.dotSize === "number" ? patch.dotSize : (h.dotSize ?? tooltipStyle.dotSize),
          dotColor: typeof patch.dotColor === "string" ? patch.dotColor : (h.dotColor ?? tooltipStyle.dotColor),
          dotStrokePx: typeof patch.dotStrokePx === "number" ? patch.dotStrokePx : (h.dotStrokePx ?? tooltipStyle.dotStrokePx),
          dotStrokeColor: typeof patch.dotStrokeColor === "string" ? patch.dotStrokeColor : (h.dotStrokeColor ?? tooltipStyle.dotStrokeColor),
          animation: typeof patch.animation !== "undefined" ? patch.animation : (h.animation ?? tooltipStyle.animation),
        }));
      }
      return next;
    });
  };

  // Inject simple keyframes for optional animations used by tooltips
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

  const handleSave = async () => {
    const draft: EditedDraft = {
      draftId: (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: undefined,
      steps: steps.map((s, idx) => ({ id: s.id, pageUrl: s.pageUrl, order: idx })),
      hotspotsByStep: hotspotsByStep,
    };

    if (!isAuthenticated) {
      try {
        localStorage.setItem(`demoEditedDraft:${draft.draftId}`, JSON.stringify(draft));
        localStorage.setItem("pendingDraftId", draft.draftId);
      } catch (_) {}
      pendingDraftRef.current = draft;
      setSavingDemo(true);
      setAuthOpen(true);
      return;
    }

    try {
      setSavingDemo(true);
      if (demoIdParam) {
        const updates = steps.map(async (s) => {
          // Skip lead-capture pseudo steps; they are not persisted backend steps
          if (s.isLeadCapture) return;
          const hs = hotspotsByStep[s.id] ?? [];
          await updateDemoStepHotspots({ demoId: demoIdParam, stepId: s.id, hotspots: hs as any });
        });
        await Promise.all(updates);
        // Persist lead configuration (index/bg/config) on METADATA
        try {
          const leadIdx = steps.findIndex((s) => Boolean(s.isLeadCapture));
          if (leadIdx >= 0) {
            const bg = steps[leadIdx]?.leadBg === "black" ? "black" : "white";
            const leadConfig = { style: "solid", bg } as any; // future-proof config container
            await updateDemoLeadConfig({ demoId: demoIdParam, leadStepIndex: leadIdx, leadConfig });
          } else {
            await updateDemoLeadConfig({ demoId: demoIdParam, leadStepIndex: null });
          }
        } catch (e) {
          console.warn("Failed to persist lead config (non-fatal)", e);
        }
        // Persist global hotspot tooltip style so the right panel restores it next visit
        try {
          await updateDemoStyleConfig({ demoId: demoIdParam, hotspotStyle: tooltipStyle });
        } catch (e) {
          console.warn("Failed to persist hotspot style (non-fatal)", e);
        }
        try {
          await mirrorDemoToPublic(demoIdParam);
        } catch (mirrorErr) {
          console.warn("Mirror to public failed (will still keep private saved).", mirrorErr);
        }
        toast.success("Saved annotations");
      } else {
        const { demoId, stepCount } = await syncAnonymousDemo({ inlineDraft: draft });
        console.log("Saved demo", demoId, "with steps:", stepCount);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("demoId", demoId);
          window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
        } catch {
          window.location.href = `${window.location.pathname}?demoId=${demoId}`;
        }
      }
    } catch (e) {
      console.error("Failed to save demo:", e);
      alert("Failed to save demo. Please try again.");
    } finally {
      setSavingDemo(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    if (isCurrentLeadStep) return; // disable hotspot interactions on lead steps
    if (isPreviewing || editingTooltip) return;
    if (!currentStepId) return;
    // If there is an existing hotspot, only start editing/dragging when clicking the dot region
    if (currentHotspots.length >= 1) {
      const existing = currentHotspots[0];
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // compute rendered center of dot from normalized coords
      if (existing.xNorm !== undefined && existing.yNorm !== undefined && naturalSize) {
        const rr = computeRenderRect(rect.width, rect.height, naturalSize.w, naturalSize.h);
        const centerX = rr.x + existing.xNorm * rr.w;
        const centerY = rr.y + existing.yNorm * rr.h;
        const dotSize = Math.max(6, Math.min(48, Number(existing.dotSize ?? 12)));
        const radius = dotSize / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const inside = dx * dx + dy * dy <= radius * radius;
        if (inside) {
          // Begin potential drag; decide click vs drag on mouseup by movement threshold
          setIsDraggingHotspot(true);
          setDragHotspotId(existing.id);
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }
      // Click not on the dot: do nothing (do not open editor)
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    if (isCurrentLeadStep) return;
    // Drag to move existing hotspot
    if (isDraggingHotspot && dragHotspotId && currentStepId && naturalSize) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rr = computeRenderRect(rect.width, rect.height, naturalSize.w, naturalSize.h);
      if (rr.w <= 0 || rr.h <= 0) return;
      let xNorm = (x - rr.x) / rr.w;
      let yNorm = (y - rr.y) / rr.h;
      xNorm = Math.max(0, Math.min(1, xNorm));
      yNorm = Math.max(0, Math.min(1, yNorm));
      setHotspotsByStep((prev) => {
        const list = prev[currentStepId] ?? [];
        return {
          ...prev,
          [currentStepId]: list.map((h) => (h.id === dragHotspotId ? { ...h, xNorm, yNorm } : h)),
        };
      });
      return;
    }

    // Drawing a new hotspot
    if (!isDrawing || !imageRef.current) return;
    // Optionally, we could preview the rectangle; currently unused.
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    if (isCurrentLeadStep) return;
    if (!currentStepId) return;

    // Finish dragging existing hotspot
    if (isDraggingHotspot) {
      const start = dragStartRef.current;
      setIsDraggingHotspot(false);
      const id = dragHotspotId;
      setDragHotspotId(null);
      dragStartRef.current = null;
      // If it was a simple click (no movement), open editor for that hotspot
      if (start && id) {
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved < 3) {
          const existing = (hotspotsByStep[currentStepId] ?? []).find((h) => h.id === id);
          if (existing) {
            setEditingTooltip(existing.id);
            setTooltipText(existing.tooltip ?? "");
          }
        }
      }
      return;
    }

    if (!isDrawing) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let xNorm: number | undefined;
    let yNorm: number | undefined;
    try {
      const url = steps[selectedStepIndex]?.screenshotUrl;
      if (url && naturalSize) {
        const rr = computeRenderRect(rect.width, rect.height, naturalSize.w, naturalSize.h);
        if (rr.w > 0 && rr.h > 0) {
          xNorm = (x - rr.x) / rr.w;
          yNorm = (y - rr.y) / rr.h;
          xNorm = Math.max(0, Math.min(1, xNorm));
          yNorm = Math.max(0, Math.min(1, yNorm));
        }
      }
    } catch (_e) {}

    // Enforce single hotspot per step: update existing if present; else create new
    if (currentHotspots.length >= 1) {
      const existing = currentHotspots[0];
      const updated: Hotspot = {
        ...existing,
        x: Math.min(startPos.x, x),
        y: Math.min(startPos.y, y),
        width: Math.abs(x - startPos.x),
        height: Math.abs(y - startPos.y),
        xNorm,
        yNorm,
      };
      setHotspotsByStep((prev) => ({
        ...prev,
        [currentStepId]: [updated],
      }));
      setIsDrawing(false);
      setEditingTooltip(existing.id);
      setTooltipText(existing.tooltip ?? "");
      return;
    }

    const newHotspot: Hotspot = {
      id: Math.random().toString(36).substring(7),
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
      xNorm,
      yNorm,
      dotSize: tooltipStyle.dotSize,
      dotColor: tooltipStyle.dotColor,
      dotStrokePx: tooltipStyle.dotStrokePx,
      dotStrokeColor: tooltipStyle.dotStrokeColor,
      animation: tooltipStyle.animation,
    };

    setHotspotsByStep((prev) => ({
      ...prev,
      [currentStepId]: [newHotspot],
    }));
    setIsDrawing(false);

    setEditingTooltip(newHotspot.id);
    setTooltipText("");
  };

  const handleTooltipChange = (id: string, text: string) => {
    if (!currentStepId) return;
    setHotspotsByStep((prev) => {
      const list = prev[currentStepId] ?? [];
      return {
        ...prev,
        [currentStepId]: list.map((h) => (h.id === id ? { ...h, tooltip: text } : h)),
      };
    });
  };

  const handleTooltipSubmit = (id: string) => {
    handleTooltipChange(id, tooltipText);
    setEditingTooltip(null);
    setTooltipText("");
    setSelectedStepIndex((idx) => {
      const next = idx + 1;
      return next < steps.length ? next : idx;
    });
  };

  // Keyboard shortcuts for inline tooltip editor (Enter=save, Escape=cancel)
  useKeyboardShortcut(
    [
      {
        key: "Enter",
        handler: (e) => {
          if (!editingTooltip) return;
          e.preventDefault();
          handleTooltipSubmit(editingTooltip);
        },
        preventDefault: true,
      },
      {
        key: "Escape",
        handler: () => {
          if (!editingTooltip) return;
          setEditingTooltip(null);
          setTooltipText("");
        },
        preventDefault: true,
      },
    ],
    { enabled: !!editingTooltip }
  );

  // Steps to include in preview: any with a hotspot OR the lead-capture step
  const previewableIndices = steps
    .map((s, idx) => (s.isLeadCapture || (hotspotsByStep[s.id]?.length ? true : false) ? idx : -1))
    .filter((v) => v >= 0);

  const enterPreview = () => {
    setIsPreviewing(true);
    if (currentStepId && !(hotspotsByStep[currentStepId]?.length > 0) && !isCurrentLeadStep) {
      if (previewableIndices.length > 0) setSelectedStepIndex(previewableIndices[0]);
    }
  };

  const exitPreview = () => {
    setIsPreviewing(false);
  };

  const gotoPrevAnnotated = () => {
    if (previewableIndices.length === 0) return;
    const pos = previewableIndices.indexOf(selectedStepIndex);
    const prevPos = pos > 0 ? pos - 1 : 0;
    setSelectedStepIndex(previewableIndices[prevPos]);
  };

  const gotoNextAnnotated = () => {
    if (previewableIndices.length === 0) return;
    const pos = previewableIndices.indexOf(selectedStepIndex);
    const nextPos = pos >= 0 && pos < previewableIndices.length - 1 ? pos + 1 : pos;
    if (nextPos >= 0) setSelectedStepIndex(previewableIndices[nextPos]);
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-1">Demo Editor</h1>
        <div className="mb-3 text-xs text-gray-600">
          {demoIdParam ? `Viewing saved demo: ${demoIdParam}` : "Editing local captures"}
        </div>
        <div className="mb-4 flex items-center gap-3">
          {demoIdParam && (
            <>
              <div className="flex items-center gap-2 mr-4">
                <Input
                  value={demoName}
                  placeholder="Untitled Demo"
                  onChange={(e) => setDemoName(e.target.value)}
                  className="h-8 text-sm w-64"
                />
                <button
                  onClick={async () => {
                    if (!demoIdParam) return;
                    try {
                      setSavingTitle(true);
                      await renameDemo(demoIdParam, demoName || "");
                    } catch (e) {
                      console.error("Failed to rename demo", e);
                      alert("Failed to save title. Please try again.");
                    } finally {
                      setSavingTitle(false);
                    }
                  }}
                  disabled={savingTitle || savingDemo}
                  className={`text-sm py-1.5 px-2 rounded border ${savingTitle ? "opacity-60" : ""}`}
                >
                  {savingTitle ? "Saving..." : "Save Title"}
                </button>
              </div>
              <div className="flex items-center gap-2 mr-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    demoStatus === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {demoStatus}
                </span>
                <button
                  onClick={async () => {
                    if (!demoIdParam) return;
                    const next = demoStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
                    try {
                      setTogglingStatus(true);
                      await setDemoStatus(demoIdParam, next);
                      setDemoStatusLocal(next);
                    } catch (e) {
                      console.error("Failed to update status", e);
                      alert("Failed to update status. Please try again.");
                    } finally {
                      setTogglingStatus(false);
                    }
                  }}
                  disabled={togglingStatus || savingDemo}
                  className={`text-sm py-1.5 px-2 rounded border bg-white hover:bg-gray-50 ${
                    togglingStatus ? "opacity-60" : ""
                  }`}
                >
                  {demoStatus === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={async () => {
                    if (!demoIdParam) return;
                    const ok = confirm("Delete this demo? This cannot be undone.");
                    if (!ok) return;
                    try {
                      setDeleting(true);
                      await deleteDemo(demoIdParam);
                      window.location.href = "/dashboard";
                    } catch (e) {
                      console.error("Failed to delete demo", e);
                      alert("Failed to delete demo. Please try again.");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting || savingDemo}
                  className={`text-sm py-1.5 px-2 rounded border bg-red-600 text-white hover:bg-red-700 ${
                    deleting ? "opacity-70" : ""
                  }`}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => (isPreviewing ? exitPreview() : enterPreview())}
            className={`text-sm py-2 px-3 rounded border ${
              isPreviewing ? "bg-green-100 border-green-400" : "bg-white border-gray-300"
            }`}
            title="Toggle preview mode"
          >
            {isPreviewing ? "Preview: On (Esc to stop)" : "Preview: Off"}
          </button>
          <button
            onClick={handleSave}
            disabled={savingDemo}
            className={`text-sm py-2 px-3 rounded ${
              savingDemo ? "bg-blue-400 cursor-not-allowed text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {savingDemo ? "Saving..." : "Save"}
          </button>
          {!isAuthenticated && (
            <span className="text-xs text-gray-500">You can freely edit. Saving requires sign in.</span>
          )}
          {loadingSteps && <span className="text-xs text-gray-400">Loading steps…</span>}
          {!loadingSteps && steps.length > 0 && (
            <span className="text-xs text-gray-600">Loaded {steps.length} captured steps</span>
          )}
          {isPreviewing && (
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={gotoPrevAnnotated} className="text-sm py-1 px-2 rounded border bg-white border-gray-300">
                Prev
              </button>
              <span className="text-xs text-gray-600">
                {previewableIndices.length > 0
                  ? `${previewableIndices.indexOf(selectedStepIndex) + 1} / ${previewableIndices.length}`
                  : "0 / 0"}
              </span>
              <button onClick={gotoNextAnnotated} className="text-sm py-1 px-2 rounded border bg-white border-gray-300">
                Next
              </button>
            </div>
          )}
        </div>
        <div
          ref={imageRef}
          className="bg-gray-200 border rounded-xl w-full min-h-[320px] flex items-center justify-center relative overflow-hidden"
          style={
            effectiveNaturalSize
              ? {
                  aspectRatio: `${effectiveNaturalSize.w} / ${effectiveNaturalSize.h}`,
                  width: "100%",
                  maxWidth: `${effectiveNaturalSize.w}px`,
                }
              : undefined
          }
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {!isCurrentLeadStep && loadingSteps && steps.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20 pointer-events-none">
              <div className="flex items-center gap-2 text-gray-700">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            </div>
          )}
          {steps.length > 0 ? (
            isCurrentLeadStep ? (
              <LeadCaptureOverlay
                bg={steps[selectedStepIndex]?.leadBg === "black" ? "black" : "white"}
              />
            ) : isPreviewing ? (
              <HotspotOverlay
                className="absolute inset-0 w-full h-full"
                imageUrl={steps[selectedStepIndex]?.screenshotUrl}
                hotspots={currentHotspots as any}
              />
            ) : (
              <img
                src={steps[selectedStepIndex]?.screenshotUrl}
                alt={`Step ${selectedStepIndex + 1}`}
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
                className={`absolute inset-0 w-full h-full object-contain ${
                  imageLoading ? "opacity-50" : "opacity-100"
                }`}
              />
            )
          ) : demoIdParam && !loadingSteps ? (
            <span className="text-gray-500 text-sm">No steps found for this demo or unable to load images.</span>
          ) : !loadingSteps ? (
            <div className="text-center text-gray-700 p-8">
              <h3 className="text-lg font-semibold mb-2">No captures detected</h3>
              <p className="text-sm text-gray-500 mb-4">
                We couldn't find any captured steps from the extension. You can try recording again, or follow our guide
                for troubleshooting.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href="#"
                  className="inline-flex items-center px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
                >
                  Have trouble recording? Read this guide
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  Talk to our team
                </a>
              </div>
            </div>
          ) : null}

          {!isPreviewing && !isCurrentLeadStep && currentHotspots.map((hotspot) => {
            const containerRect = imageRef.current?.getBoundingClientRect();
            let centerX = 0;
            let centerY = 0;
            if (hotspot.xNorm !== undefined && hotspot.yNorm !== undefined && containerRect && naturalSize) {
              const rr = computeRenderRect(containerRect.width, containerRect.height, naturalSize.w, naturalSize.h);
              centerX = rr.x + hotspot.xNorm * rr.w;
              centerY = rr.y + hotspot.yNorm * rr.h;
            } else if (typeof hotspot.x === "number" && typeof hotspot.y === "number") {
              centerX = hotspot.x + (hotspot.width || 0) / 2;
              centerY = hotspot.y + (hotspot.height || 0) / 2;
            }
            const dotSize = Math.max(6, Math.min(48, Number(hotspot.dotSize ?? 12)));
            const tooltipLeft = centerX + dotSize + 6;
            const tooltipTop = centerY - 8;
            const color = hotspot.dotColor || "#2563eb";
            const anim = hotspot.animation || "none";
            const animStyle: React.CSSProperties =
              anim === "pulse"
                ? { } // Tailwind's animate-pulse class below
                : anim === "breathe"
                ? { animation: "propels-breathe 1.8s ease-in-out infinite" }
                : anim === "fade"
                ? { animation: "propels-fade 1.4s ease-in-out infinite" }
                : {};
            return (
              <div key={hotspot.id}>
                <div
                  className={`absolute rounded-full shadow ${anim === "pulse" ? "animate-pulse" : ""}`}
                  style={{
                    left: `${centerX - dotSize / 2}px`,
                    top: `${centerY - dotSize / 2}px`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: color,
                    borderStyle: "solid",
                    borderWidth: `${Math.max(0, Number(hotspot.dotStrokePx ?? tooltipStyle.dotStrokePx))}px`,
                    borderColor: String(hotspot.dotStrokeColor ?? tooltipStyle.dotStrokeColor),
                    ...animStyle,
                  }}
                />

                {editingTooltip === hotspot.id && (
                  <div
                    className="absolute bg-white border rounded p-2 shadow-lg"
                    style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Input
                      type="text"
                      placeholder="Add tooltip text"
                      value={tooltipText}
                      onChange={(e) => setTooltipText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleTooltipSubmit(hotspot.id);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingTooltip(null);
                          setTooltipText("");
                        }
                      }}
                      className="mb-2"
                      autoFocus
                    />
                    <button
                      onClick={() => handleTooltipSubmit(hotspot.id)}
                      className="bg-blue-500 hover:bg-blue-700 text-white text-sm py-1 px-2 rounded"
                    >
                      Save
                    </button>
                  </div>
                )}

                {editingTooltip !== hotspot.id && hotspot.tooltip && (
                  <div
                    className="absolute bg-blue-600 text-white text-xs rounded py-1 px-2 shadow"
                    style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
                  >
                    {hotspot.tooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="w-80 bg-gray-100 p-4 border-l space-y-6">
        <h2 className="text-xl font-semibold mb-2 flex items-center justify-between">
          <span>Steps</span>
          <button
            title="Add lead generation step"
            className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
            onClick={() => {
              setLeadUiOpen((v) => !v);
              const safeLen = Math.max(1, steps.length);
              const suggested = Math.min(safeLen, selectedStepIndex + 1);
              setLeadInsertAnchor(suggested);
              setLeadInsertPos("after");
            }}
          >
            + Lead
          </button>
        </h2>
        {leadUiOpen && (
          <div className="mb-3 p-3 bg-white border rounded-lg shadow-sm text-xs text-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Add lead form</span>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="leadpos"
                  className="accent-blue-600"
                  checked={leadInsertPos === "before"}
                  onChange={() => setLeadInsertPos("before")}
                />
                <span>before</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="leadpos"
                  className="accent-blue-600"
                  checked={leadInsertPos === "after"}
                  onChange={() => setLeadInsertPos("after")}
                />
                <span>after</span>
              </label>
              <span>step</span>
              <select
                value={leadInsertAnchor}
                onChange={(e) => setLeadInsertAnchor(Math.max(1, Math.min(Math.max(1, steps.length), parseInt(e.target.value || "1", 10))))}
                className="border rounded px-2 py-1 text-xs bg-white"
              >
                {Array.from({ length: Math.max(1, steps.length) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    const anchor0 = Math.max(1, Math.min(Math.max(1, steps.length), leadInsertAnchor)) - 1; // 0-based
                    const insertIndex = leadInsertPos === "before" ? anchor0 : anchor0 + 1;
                    const newStep = {
                      id: `LEAD-${Math.random().toString(36).slice(2,9)}`,
                      pageUrl: "",
                      screenshotUrl: undefined,
                      isLeadCapture: true as const,
                      leadBg: "white" as const,
                    };
                    setSteps((prev) => {
                      const next = [...prev];
                      const idx = Math.max(0, Math.min(next.length, insertIndex));
                      next.splice(idx, 0, newStep);
                      return next;
                    });
                    setHotspotsByStep((prev) => ({ ...prev }));
                    const nextIndex = Math.max(0, Math.min(steps.length, insertIndex));
                    setSelectedStepIndex(nextIndex);
                    setLeadUiOpen(false);
                  }}
                >
                  Insert
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                  onClick={() => setLeadUiOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {steps.length === 0 && !loadingSteps && (
            <div className="text-xs text-gray-600">
              No steps yet. Try recording again, or
              <a href="#" className="text-blue-600 hover:underline mx-1">
                read the guide
              </a>
              or
              <a
                href="https://cal.com/propels/demo-help"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline ml-1"
              >
                talk to our team
              </a>
              .
            </div>
          )}
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setSelectedStepIndex(idx)}
              className={`w-full flex gap-3 items-center bg-white p-2 rounded-lg shadow border text-left hover:border-blue-500 ${
                idx === selectedStepIndex ? "border-blue-600" : "border-transparent"
              }`}
            >
              {s.isLeadCapture ? (
                <div className={`w-16 h-12 rounded flex items-center justify-center text-[10px] border ${s.leadBg === 'black' ? 'bg-black text-white' : 'bg-white text-gray-700'}`}>
                  LEAD
                </div>
              ) : (
                <img src={s.screenshotUrl} alt="thumb" className="w-16 h-12 object-cover rounded" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">Step {idx + 1}</p>
                <p className="text-[10px] text-gray-500 truncate">{s.isLeadCapture ? 'Lead capture' : s.pageUrl}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Tooltip Inspector */}
        <div className="pt-4 border-t mt-6">
          <h3 className="text-lg font-semibold mb-3">Tooltip Inspector</h3>
          {isCurrentLeadStep ? (
            <div className="text-xs text-gray-600">Lead capture step has no hotspots.</div>
          ) : currentHotspots.length === 0 ? (
            <div className="text-xs text-gray-600">No tooltip on this step. Click on the image to add one.</div>
          ) : (
            (() => {
              return (
                <div className="space-y-3 text-sm">
                  {/* Tabs */}
                  <div className="flex gap-2 text-xs">
                    <button
                      className={`px-2 py-1 rounded border ${inspectorTab === 'fill' ? 'bg-white border-blue-500 text-blue-700' : 'bg-gray-50 border-transparent'}`}
                      onClick={() => setInspectorTab('fill')}
                    >
                      Fill
                    </button>
                    <button
                      className={`px-2 py-1 rounded border ${inspectorTab === 'stroke' ? 'bg-white border-blue-500 text-blue-700' : 'bg-gray-50 border-transparent'}`}
                      onClick={() => setInspectorTab('stroke')}
                    >
                      Stroke
                    </button>
                  </div>

                  {inspectorTab === 'fill' ? (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Size (px)</label>
                        <input
                          type="range"
                          min={6}
                          max={48}
                          step={1}
                          value={Number(tooltipStyle.dotSize)}
                          onChange={(e) => applyGlobalStyle({ dotSize: Number(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-[10px] text-gray-500 mt-0.5">{Number(tooltipStyle.dotSize)} px</div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Color</label>
                        <input
                          type="color"
                          value={tooltipStyle.dotColor}
                          onChange={(e) => applyGlobalStyle({ dotColor: e.target.value })}
                          className="w-10 h-8 p-0 border rounded"
                          title="Choose color"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Width (px)</label>
                        <input
                          type="range"
                          min={0}
                          max={8}
                          step={1}
                          value={Number(tooltipStyle.dotStrokePx)}
                          onChange={(e) => applyGlobalStyle({ dotStrokePx: Number(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-[10px] text-gray-500 mt-0.5">{Number(tooltipStyle.dotStrokePx)} px</div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Color</label>
                        <input
                          type="color"
                          value={tooltipStyle.dotStrokeColor}
                          onChange={(e) => applyGlobalStyle({ dotStrokeColor: e.target.value })}
                          className="w-10 h-8 p-0 border rounded"
                          title="Choose stroke color"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Animation (applies to all steps)</label>
                    <select
                      value={tooltipStyle.animation}
                      onChange={(e) => applyGlobalStyle({ animation: e.target.value as any })}
                      className="w-full border rounded p-1 bg-white"
                    >
                      <option value="none">None</option>
                      <option value="pulse">Pulse</option>
                      <option value="breathe">Breathe</option>
                      <option value="fade">Fade</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSave}
                      className="text-xs px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        if (!currentStepId) return;
                        setHotspotsByStep((prev) => ({ ...prev, [currentStepId]: [] }));
                        setEditingTooltip(null);
                        setTooltipText("");
                      }}
                      className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                    >
                      Delete Tooltip
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
      <Dialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          // If the user closes the auth dialog without authenticating, stop the saving state
          if (!open && !isAuthenticated) {
            setSavingDemo(false);
          }
        }}
      >
        <DialogContent showCloseButton={true} className="p-0">
          <PasswordlessAuth
            isInDialog
            hasAnonymousSession
            onAuthSuccess={async () => {
              // Close dialog immediately and inform user while we save
              const draft = pendingDraftRef.current;
              setAuthOpen(false);
              setSavingDemo(true);
              const toastId = toast.loading("Saving your demo…");
              try {
                const { demoId, stepCount } = await syncAnonymousDemo(draft ? { inlineDraft: draft } : undefined);
                console.log("Saved demo", demoId, "with steps:", stepCount);
                toast.success("Demo saved", { description: `${stepCount} steps uploaded.` });
                // Stay on editor page and attach demoId as query param
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.set("demoId", demoId);
                  window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
                } catch {
                  window.location.href = `${window.location.pathname}?demoId=${demoId}`;
                }
              } catch (e) {
                console.error("Failed to save demo after auth:", e);
                toast.error("Failed to save demo", { description: "Please try again." });
              } finally {
                toast.dismiss(toastId);
                setSavingDemo(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DemoEditorPage;
