import React, { useEffect, useState, useRef } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { syncAnonymousDemo, type EditedDraft } from "../lib/services/syncAnonymousDemo";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useSearchParams, useNavigate } from "react-router-dom";
import { deleteDemo, renameDemo, setDemoStatus, createDemoStep, getOwnerId, updateDemoStepZoom } from "@/lib/api/demos";
import { trackEditorEntered, trackDemoSaved } from "@/lib/analytics";
import {
  updateDemoStepHotspots,
  updateDemoLeadConfig,
  updateDemoStyleConfig,
  mirrorDemoToPublic,
  deletePublicDemoItems,
} from "@/features/editor/services/editorPersistence";
import { useEditorData } from "@/features/editor/hooks/useEditorData";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";
import { EditorSidebar } from "@/features/editor/components/EditorSidebar";
import { TooltipEditor } from "@/features/editor/components/TooltipEditor";
import { toast } from "sonner";
import { Loader2, Copy, Eye } from "lucide-react";
import LeadCaptureOverlay from "@/components/LeadCaptureOverlay";
import EditorHeader from "@/features/editor/components/EditorHeader";
import HotspotOverlay from "@/components/HotspotOverlay";
import { type HotspotsMap, type TooltipStyle } from "@/lib/editor/deriveTooltipStyleFromHotspots";
import { applyGlobalStyleToHotspots } from "@/lib/editor/applyGlobalStyleToHotspots";
import { extractLeadConfig } from "@/lib/editor/extractLeadConfig";
import { Dialog as UIDialog, DialogContent as UIDialogContent } from "@/components/ui/dialog";
import { DeleteDemoModal } from "@/components/DeleteConfirmationModal";

export function DemoEditorPage() {
  const { user, isLoading } = useAuth();
  const isAuthenticated = !!user?.userId || !!user?.username;
  const [searchParams] = useSearchParams();
  const demoIdParam = searchParams.get("demoId") || searchParams.get("demoid") || undefined;

  const navigate = useNavigate();
  // If a demoId is present, require authentication; otherwise redirect to /editor
  useEffect(() => {
    if (!demoIdParam) return;
    if (!isLoading && !isAuthenticated) {
      navigate("/editor", { replace: true });
    }
  }, [demoIdParam, isAuthenticated, isLoading, navigate]);
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
      // Zoom level (100-150 representing 100%-150%)
      zoom?: number;
    }>
  >([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  // Lead step quick-insert MVP controls
  const [authOpen, setAuthOpen] = useState(false);
  const pendingDraftRef = useRef<EditedDraft | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Delete handler function
  const handleDeleteDemo = async () => {
    if (!demoIdParam) return;
    try {
      await deleteDemo(demoIdParam);
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Failed to delete demo", e);
      alert("Failed to delete demo. Please try again.");
      throw e; // Re-throw so the modal can handle the error state
    }
  };
  // Metadata for saved demo (when demoId exists)
  const [demoName, setDemoName] = useState<string>("");
  const [demoStatus, setDemoStatusLocal] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [savingTitle, setSavingTitle] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [savingDemo, setSavingDemo] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Retry counter for backend load (handle eventual consistency right after creation)
  const loadAttemptsRef = useRef<number>(0);

  // New: hook to load data for saved demos (backend path)
  const ed = useEditorData(demoIdParam || undefined);
  // Track original step IDs loaded from backend
  const [originalStepIds, setOriginalStepIds] = useState<Set<string>>(new Set());

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
    tooltip?: string | { title?: string; description?: string; text?: string }; // Support both string and structured format
    // Styling fields
    dotSize?: number; // px
    dotColor?: string; // e.g., #2563eb
    animation?: "none" | "pulse" | "breathe" | "fade";
    dotStrokePx?: number; // border width in px
    dotStrokeColor?: string; // border color
    // Tooltip text bubble styling
    tooltipBgColor?: string;
    tooltipTextColor?: string;
    tooltipTextSizePx?: number;
  };

  const [hotspotsByStep, setHotspotsByStep] = useState<Record<string, Hotspot[]>>({});
  const [editingTooltip, setEditingTooltip] = useState<string | null>(null);
  const [tooltipTitle, setTooltipTitle] = useState("");
  const [tooltipDescription, setTooltipDescription] = useState("");
  // Lead form config
  const [leadFormConfig, setLeadFormConfig] = useState<any>({
    title: "Like what you see?",
    subtitle: "Drop your email and we'll help you implement this in your workflow.",
    ctaText: "Get started",
    fields: [{ key: "email", type: "email", label: "Email", required: true, placeholder: "you@company.com" }],
  });
  // Global tooltip style for consistency across all steps
  const [tooltipStyle, setTooltipStyle] = useState<{
    dotSize: number;
    dotColor: string;
    dotStrokePx: number;
    dotStrokeColor: string;
    animation: "none" | "pulse" | "breathe" | "fade";
    tooltipBgColor?: string;
    tooltipTextColor?: string;
    tooltipTextSizePx?: number;
  }>({
    dotSize: 36,
    dotColor: "#2563eb",
    dotStrokePx: 2,
    dotStrokeColor: "#ffffff",
    animation: "pulse",
    tooltipBgColor: "#2563eb",
    tooltipTextColor: "#ffffff",
    tooltipTextSizePx: 12,
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
  // Track container size to trigger re-render on resize so tooltip positions recompute
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const isCurrentLeadStep = Boolean(steps[selectedStepIndex]?.isLeadCapture);
  // Keep canvas size consistent on lead steps: use last known naturalSize or a sane default
  const effectiveNaturalSize = isCurrentLeadStep && !naturalSize ? { w: 1280, h: 800 } : naturalSize;

  const currentStepId = steps[selectedStepIndex]?.id;
  const currentHotspots: Hotspot[] = currentStepId ? (hotspotsByStep[currentStepId] ?? []) : [];

  useEffect(() => {
    const loadFromExtension = async () => {
      try {
        setLoadingSteps(true);
        const extId = (import.meta as any).env?.VITE_CHROME_EXTENSION_ID || "";
        if (typeof chrome !== "undefined" && chrome.runtime && extId) {
          const response = await chrome.runtime.sendMessage(extId, {
            type: "GET_CAPTURE_SESSION",
          });
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

            // Track editor entry with extension data
            trackEditorEntered("extension", undefined);

            (async () => {
              try {
                const DEFAULT_W = 12;
                const DEFAULT_H = 12;

                const initial: Record<string, Hotspot[]> = {};

                await Promise.all(
                  urls.map(
                    (s, index) =>
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

                          // Add educational tooltip for first step
                          const defaultTooltip =
                            index === 0
                              ? {
                                  title: "👋 Welcome to the Editor!",
                                  description:
                                    "Click this dot to add your own tooltip text. Guide your viewers through each step of your demo.",
                                }
                              : "";

                          const hotspot: Hotspot = {
                            id: Math.random().toString(36).slice(2, 9),
                            xNorm,
                            yNorm,
                            width: DEFAULT_W,
                            height: DEFAULT_H,
                            tooltip: defaultTooltip,
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
        console.error("No extension data available", err);
      }
    };

    loadAttemptsRef.current = 0;
    if (!demoIdParam) {
      loadFromExtension();
    }
  }, [demoIdParam]);

  // Sync local UI state from useEditorData when editing a saved demo
  useEffect(() => {
    if (!demoIdParam) return;
    setLoadingSteps(ed.loading);
    if (ed.loading) return;
    setDemoName(ed.demoName || "");
    setDemoStatusLocal(ed.demoStatus);
    setSteps(ed.steps as any);
    setHotspotsByStep(ed.hotspotsByStep as any);
    if (ed.leadFormConfig) setLeadFormConfig(ed.leadFormConfig);
    setTooltipStyle((prev) => ({ ...prev, ...ed.tooltipStyle }));
    setSelectedStepIndex(0);
    // Track original step IDs from backend
    setOriginalStepIds(new Set(ed.steps.map((s) => s.id)));
  }, [
    demoIdParam,
    ed.loading,
    ed.demoName,
    ed.demoStatus,
    ed.steps,
    ed.hotspotsByStep,
    ed.leadFormConfig,
    ed.tooltipStyle,
  ]);

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

  // Recompute positions on container resize (image area changes with responsive layout)
  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    const update = () => {
      try {
        const rect = el.getBoundingClientRect();
        setContainerSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      } catch {}
    };
    update();
    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver(() => update());
      observer.observe(el);
    } catch {}
    window.addEventListener("resize", update);
    return () => {
      try {
        if (observer) observer.disconnect();
      } catch {}
      try {
        window.removeEventListener("resize", update);
      } catch {}
    };
  }, []);

  const applyGlobalStyle = (
    patch: Partial<{
      dotSize: number;
      dotColor: string;
      dotStrokePx: number;
      dotStrokeColor: string;
      animation: "none" | "pulse" | "breathe" | "fade";
      tooltipBgColor?: string;
      tooltipTextColor?: string;
      tooltipTextSizePx?: number;
    }>
  ) => {
    setTooltipStyle((prev) => ({ ...prev, ...patch }));
    setHotspotsByStep(
      (prev) =>
        applyGlobalStyleToHotspots(
          prev as HotspotsMap,
          tooltipStyle as TooltipStyle,
          patch as Partial<TooltipStyle>
        ) as any
    );
  };

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
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

  const handleSave = async () => {
    const { leadStepIndex: leadIdxDraft } = extractLeadConfig(steps, leadFormConfig);
    const draft: EditedDraft = {
      draftId: (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: undefined,
      steps: steps.map((s, idx) => ({
        id: s.id,
        pageUrl: s.pageUrl,
        order: idx,
        zoom: s.zoom // Include zoom data in the draft for anonymous demos
      })),
      hotspotsByStep: hotspotsByStep,
      leadStepIndex: leadIdxDraft,
      leadConfig: leadFormConfig,
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
        const ownerId = await getOwnerId();
        if (!ownerId) throw new Error("User not authenticated");

        const updates = steps.map(async (s, idx) => {
          if (s.isLeadCapture) return;
          const hs = hotspotsByStep[s.id] ?? [];

          // Check if this is a new step (not in original backend set)
          if (!originalStepIds.has(s.id)) {
            // New step - create it
            const s3Key = (s as any).s3Key;
            if (!s3Key) {
              console.warn(`New step ${s.id} missing s3Key, skipping create`);
              return;
            }
            await createDemoStep({
              demoId: demoIdParam,
              stepId: s.id,
              s3Key,
              hotspots: hs as any,
              order: idx,
              pageUrl: s.pageUrl,
              thumbnailS3Key: (s as any).thumbnailS3Key,
              ownerId,
              zoom: s.zoom,
            });
          } else {
            // Existing step - update hotspots and zoom
            await updateDemoStepHotspots({
              demoId: demoIdParam,
              stepId: s.id,
              hotspots: hs as any,
              zoom: s.zoom
            });

            // Also update zoom separately if it exists
            if (s.zoom && s.zoom !== 100) {
              await updateDemoStepZoom({ demoId: demoIdParam, stepId: s.id, zoom: s.zoom });
            }
          }
        });
        await Promise.all(updates);
        try {
          const extracted = extractLeadConfig(steps, leadFormConfig);
          const leadConfigToSave: any = (extracted as any)?.leadConfig ?? (leadFormConfig as any);
          console.info("[Editor Save] lead config about to persist", {
            leadStepIndex: extracted.leadStepIndex,
            leadFormConfig: leadConfigToSave,
            leadFormFieldsCount: Array.isArray((leadConfigToSave as any)?.fields)
              ? (leadConfigToSave as any).fields.length
              : undefined,
          });
          await updateDemoLeadConfig({
            demoId: demoIdParam,
            leadStepIndex: extracted.leadStepIndex !== null ? extracted.leadStepIndex : null,
            leadConfig: leadConfigToSave,
          });
          if (!Array.isArray((leadConfigToSave as any)?.fields) || (leadConfigToSave as any).fields.length === 0) {
            console.warn(
              "[Editor Save] leadFormConfig has no fields at save time — public preview will show defaults until fields are saved"
            );
          }
        } catch (e) {
          console.error("Failed to persist lead config (non-fatal)", e);
        }
        try {
          await updateDemoStyleConfig({ demoId: demoIdParam, hotspotStyle: tooltipStyle });
        } catch (e) {
          console.error("Failed to persist hotspot style (non-fatal)", e);
        }
        if (demoStatus === "PUBLISHED") {
          try {
            const extractedNow = extractLeadConfig(steps, leadFormConfig);
            const leadConfigToMirror: any = (extractedNow as any)?.leadConfig ?? (leadFormConfig as any);
            const mirrorPayload = {
              name: demoName || undefined,
              leadStepIndex: extractedNow.leadStepIndex,
              leadConfig: leadConfigToMirror,
            } as const;
            console.info("[Editor Save] mirroring to PublicDemo", {
              ...mirrorPayload,
              leadFormFieldsCount: Array.isArray((leadConfigToMirror as any)?.fields)
                ? (leadConfigToMirror as any).fields.length
                : undefined,
            });
            // Use the full lead form configuration that the editor manages so fields are preserved in PublicDemo
            await mirrorDemoToPublic(demoIdParam, mirrorPayload as any);
          } catch (mirrorErr) {
            console.error("Mirror to public failed (will still keep private saved).", mirrorErr);
          }
        } else {
          try {
            await deletePublicDemoItems(demoIdParam);
          } catch (unpubErr) {
            console.error("Failed to remove public items for draft (non-fatal)", unpubErr);
          }
        }
        toast.success("Saved annotations");

        // Track demo saved for authenticated users
        trackDemoSaved(demoIdParam, demoStatus === "PUBLISHED", steps.length);
      } else {
        const { demoId, stepCount } = await syncAnonymousDemo({ inlineDraft: draft });
        console.log("Saved demo", demoId, "with steps:", stepCount);

        // Track demo saved for anonymous users
        trackDemoSaved(demoId, false, steps.length);

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
    if (isCurrentLeadStep) return;
    if (isPreviewing || editingTooltip) return;
    if (!currentStepId) return;
    if (currentHotspots.length >= 1) {
      const existing = currentHotspots[0];
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
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
          // Prevent native selection/drag while moving the hotspot dot
          e.preventDefault();
          try {
            document.body.style.userSelect = "none";
          } catch {}
          setIsDraggingHotspot(true);
          setDragHotspotId(existing.id);
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }
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

    if (!isDrawing || !imageRef.current) return;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    if (isCurrentLeadStep) return;
    if (!currentStepId) return;

    if (isDraggingHotspot) {
      const start = dragStartRef.current;
      setIsDraggingHotspot(false);
      const id = dragHotspotId;
      setDragHotspotId(null);
      dragStartRef.current = null;
      // Restore selection once dragging ends
      try {
        document.body.style.userSelect = "";
      } catch {}
      if (start && id) {
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved < 3) {
          const existing = (hotspotsByStep[currentStepId] ?? []).find((h) => h.id === id);
          if (existing) {
            setEditingTooltip(existing.id);
            // Parse existing tooltip - support both string and object format
            if (typeof existing.tooltip === "string") {
              setTooltipTitle("");
              setTooltipDescription(existing.tooltip);
            } else if (existing.tooltip && typeof existing.tooltip === "object") {
              setTooltipTitle(existing.tooltip.title || "");
              setTooltipDescription(existing.tooltip.description || existing.tooltip.text || "");
            } else {
              setTooltipTitle("");
              setTooltipDescription("");
            }
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
      // Parse existing tooltip
      if (typeof existing.tooltip === "string") {
        setTooltipTitle("");
        setTooltipDescription(existing.tooltip);
      } else if (existing.tooltip && typeof existing.tooltip === "object") {
        setTooltipTitle(existing.tooltip.title || "");
        setTooltipDescription(existing.tooltip.description || existing.tooltip.text || "");
      } else {
        setTooltipTitle("");
        setTooltipDescription("");
      }
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
    setTooltipTitle("");
    setTooltipDescription("");
  };

  const handleTooltipChange = (id: string, title: string, description: string) => {
    if (!currentStepId) return;
    setHotspotsByStep((prev) => {
      const list = prev[currentStepId] ?? [];
      // Create structured tooltip object if title exists, otherwise use plain description for backward compatibility
      const tooltipValue = title.trim() ? { title: title.trim(), description: description.trim() } : description.trim();
      return {
        ...prev,
        [currentStepId]: list.map((h) => (h.id === id ? { ...h, tooltip: tooltipValue } : h)),
      };
    });
  };

  const handleTooltipSubmit = (id: string) => {
    handleTooltipChange(id, tooltipTitle, tooltipDescription);

    setEditingTooltip(null);
    setTooltipTitle("");
    setTooltipDescription("");
  };

  useKeyboardShortcut(
    [
      {
        key: "Escape",
        handler: () => {
          if (!editingTooltip) return;
          setEditingTooltip(null);
          setTooltipTitle("");
          setTooltipDescription("");
        },
        preventDefault: true,
      },
    ],
    { enabled: !!editingTooltip }
  );

  const previewableIndices = steps
    .map((s, idx) => (s.isLeadCapture || (hotspotsByStep[s.id]?.length ? true : false) ? idx : -1))
    .filter((v) => v >= 0);

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

  const addLeadStep = (insertIndex: number) => {
    const leadStep = {
      id: `LEAD-${Date.now()}`,
      pageUrl: "",
      isLeadCapture: true as const,
      leadBg: "white" as const,
    };

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      const safeIndex = Math.max(0, Math.min(insertIndex, newSteps.length));
      newSteps.splice(safeIndex, 0, leadStep);
      // Select the newly inserted lead step using clamped index
      setSelectedStepIndex(safeIndex);
      return newSteps;
    });
  };

  const handleUpdateStepZoom = async (stepId: string, zoom: number) => {
    if (!demoIdParam) {
      // Update local state for anonymous demos
      setSteps((prevSteps) =>
        prevSteps.map((step) => (step.id === stepId ? { ...step, zoom } : step))
      );
      return;
    }

    // Update backend for saved demos
    try {
      await updateDemoStepZoom({ demoId: demoIdParam, stepId, zoom });
      // Update local state
      setSteps((prevSteps) =>
        prevSteps.map((step) => (step.id === stepId ? { ...step, zoom } : step))
      );
    } catch (e) {
      console.error("Failed to update step zoom:", e);
      alert("Failed to update zoom. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex">
      <EditorSidebar
        steps={steps}
        loadingSteps={loadingSteps}
        selectedStepIndex={selectedStepIndex}
        onSelectStep={setSelectedStepIndex}
        currentHotspots={currentHotspots}
        isCurrentLeadStep={isCurrentLeadStep}
        leadFormConfig={leadFormConfig}
        setLeadFormConfig={setLeadFormConfig}
        tooltipStyle={tooltipStyle}
        applyGlobalStyle={applyGlobalStyle}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onAddLeadStep={addLeadStep}
        onDeleteStep={(index) => {
          setSteps((prev) => {
            if (index < 0 || index >= prev.length) return prev;
            const removed = prev[index];
            const next = [...prev.slice(0, index), ...prev.slice(index + 1)];
            // Cleanup hotspots for removed step
            setHotspotsByStep((prevHs) => {
              const { [removed.id]: _omit, ...rest } = prevHs;
              return rest;
            });
            // Adjust selection
            setSelectedStepIndex((sel) => {
              if (sel === index) return Math.max(0, Math.min(index, next.length - 1));
              if (sel > index) return sel - 1;
              return sel;
            });
            return next;
          });
        }}
        onDuplicateStep={(index) => {
          setSteps((prev) => {
            if (index < 0 || index >= prev.length) return prev;
            const original = prev[index];
            const dupId = (crypto as any).randomUUID
              ? (crypto as any).randomUUID()
              : `DUP-${original.id}-${Date.now()}`;
            const duplicate = { ...original, id: dupId } as (typeof prev)[number];
            const next = [...prev.slice(0, index + 1), duplicate, ...prev.slice(index + 1)];
            // Duplicate hotspots mapping
            setHotspotsByStep((prevHs) => {
              const clone = Array.isArray(prevHs[original.id])
                ? prevHs[original.id].map((h) => ({ ...h, id: Math.random().toString(36).slice(2, 9) }))
                : [];
              return { ...prevHs, [dupId]: clone } as any;
            });
            // Select the duplicate
            setSelectedStepIndex(index + 1);
            return next;
          });
        }}
        onReorderSteps={(from, to) => {
          setSteps((prev) => {
            if (from === to) return prev;
            if (from < 0 || from >= prev.length) return prev;
            const clampedTo = Math.max(0, Math.min(to, prev.length - 1));
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(clampedTo, 0, moved);
            // Maintain selection by id
            setSelectedStepIndex((sel) => {
              const currentId = prev[sel]?.id;
              const newIndex = next.findIndex((s) => s.id === currentId);
              return newIndex >= 0 ? newIndex : Math.max(0, Math.min(sel, next.length - 1));
            });
            return next;
          });
        }}
        onUpdateStepZoom={handleUpdateStepZoom}
      />
      <div className="flex-1 p-8">
        <EditorHeader
          demoId={demoIdParam || undefined}
          demoName={demoName}
          onChangeName={(name) => setDemoName(name)}
          savingTitle={savingTitle}
          savingDemo={savingDemo}
          demoStatus={demoStatus}
          togglingStatus={togglingStatus}
          isPreviewing={isPreviewing}
          previewableCount={previewableIndices.length}
          currentPreviewIndex={Math.max(0, previewableIndices.indexOf(selectedStepIndex))}
          onSelectPreviewIndex={(pos) => {
            const targetIdx = previewableIndices[pos] ?? selectedStepIndex;
            setSelectedStepIndex(targetIdx);
          }}
          onPrevPreview={gotoPrevAnnotated}
          onNextPreview={gotoNextAnnotated}
          onPreview={() => setIsPreviewing(!isPreviewing)}
          onSaveTitle={async (newTitle?: string) => {
            if (!demoIdParam) return;
            try {
              setSavingTitle(true);
              // Use the passed newTitle if provided, otherwise fall back to current demoName
              const titleToSave = newTitle !== undefined ? newTitle : demoName || "";
              await renameDemo(demoIdParam, titleToSave);
            } catch (e) {
              console.error("Failed to rename demo", e);
              alert("Failed to save title. Please try again.");
            } finally {
              setSavingTitle(false);
            }
          }}
          onToggleStatus={async () => {
            if (!demoIdParam) return;
            const next = demoStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
            try {
              setTogglingStatus(true);
              const loadingMsg = next === "PUBLISHED" ? "Publishing…" : "Unpublishing…";
              const toastId = toast.loading(loadingMsg);
              if (next === "PUBLISHED") {
                try {
                  const { leadStepIndex, leadConfig } = extractLeadConfig(steps, leadFormConfig);
                  if (leadStepIndex !== null) {
                    await updateDemoLeadConfig({ demoId: demoIdParam, leadStepIndex, leadConfig: leadConfig as any });
                  } else {
                    await updateDemoLeadConfig({ demoId: demoIdParam, leadStepIndex: null });
                  }
                } catch (e) {
                  console.error("Failed to persist lead config before publish (non-fatal)", e);
                }
              }
              console.info("[editor] calling setDemoStatus with:", { demoId: demoIdParam, status: next });
              await setDemoStatus(demoIdParam, next);
              console.info("[editor] setDemoStatus completed for:", { demoId: demoIdParam, status: next });
              setDemoStatusLocal(next);
              if (next === "PUBLISHED") setShareOpen(true);
              try {
                toast.dismiss(toastId);
              } catch {}
              if (next === "PUBLISHED") {
                toast.success("Demo published", { description: "Your demo is now live." });
              } else {
                toast.success("Demo unpublished", { description: "Your demo is now private." });
              }
            } catch (e) {
              console.error("Failed to update status", e);
              try {
                toast.error("Failed to update status", { description: "Please try again." });
              } catch {}
              alert("Failed to update status. Please try again.");
            } finally {
              setTogglingStatus(false);
            }
          }}
          onDelete={async () => {
            if (!demoIdParam) return;
            console.log("[DemoEditorPage] Opening delete modal. Demo name:", demoName, "Demo ID:", demoIdParam);
            setDeleteModalOpen(true);
          }}
          onCopyPublicUrl={async () => {
            try {
              const url = demoIdParam ? `${window.location.origin}/p/${demoIdParam}` : "";
              await navigator.clipboard.writeText(url);
              toast.success("Copied public URL");
            } catch (e) {
              try {
                prompt("Copy public URL", demoIdParam ? `${window.location.origin}/p/${demoIdParam}` : "");
              } catch {}
            }
          }}
          onCopyEmbed={async () => {
            try {
              const code = demoIdParam
                ? `<iframe src="${window.location.origin}/embed/${demoIdParam}?ar=16:9" style="width:100%;aspect-ratio:16/9;border:0;" allow="fullscreen"></iframe>`
                : "";
              await navigator.clipboard.writeText(code);
              toast.success("Copied embed code");
            } catch (e) {
              try {
                prompt(
                  "Copy iframe embed code",
                  demoIdParam
                    ? `<iframe src=\"${window.location.origin}/embed/${demoIdParam}?ar=16:9\" style=\"width:100%;aspect-ratio:16/9;border:0;\" allow=\"fullscreen\"></iframe>`
                    : ""
                );
              } catch {}
            }
          }}
          onSave={handleSave}
          onOpenShareDialog={() => setShareOpen(true)}
        />
        <div
          ref={imageRef}
          className="bg-gray-200 border rounded-xl w-full min-h-[320px] flex items-center justify-center relative overflow-hidden"
          data-container-w={containerSize.w}
          data-container-h={containerSize.h}
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
                config={leadFormConfig as any}
              />
            ) : isPreviewing ? (
              <HotspotOverlay
                className="absolute inset-0 w-full h-full"
                imageUrl={steps[selectedStepIndex]?.screenshotUrl}
                hotspots={currentHotspots as any}
                enableBubbleDrag
                zoom={steps[selectedStepIndex]?.zoom || 100}
                onBubbleDrag={(id, dxNorm, dyNorm) => {
                  setHotspotsByStep((prev) => {
                    if (!currentStepId) return prev;
                    const list = Array.isArray(prev[currentStepId]) ? [...prev[currentStepId]] : [];
                    const idx = list.findIndex((h) => h.id === id);
                    if (idx === -1) return prev;
                    const existing = list[idx] as any;
                    list[idx] = {
                      ...existing,
                      tooltipOffsetXNorm: dxNorm,
                      tooltipOffsetYNorm: dyNorm,
                    };
                    return { ...prev, [currentStepId]: list } as any;
                  });
                }}
              />
            ) : (
              <div
                className="absolute inset-0 w-full h-full flex items-center justify-center"
                style={{
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    // Apply zoom transformation only to the image container
                    transform: `scale(${(steps[selectedStepIndex]?.zoom || 100) / 100})`,
                    // Set transform-origin based on hotspot position or center
                    transformOrigin: (() => {
                      const currentHotspots = currentStepId ? (hotspotsByStep[currentStepId] ?? []) : [];
                      const zoomLevel = (steps[selectedStepIndex]?.zoom || 100) / 100;

                      if (currentHotspots.length > 0 && naturalSize) {
                        // Use first hotspot as focal point
                        const hotspot = currentHotspots[0];
                        if (hotspot.xNorm !== undefined && hotspot.yNorm !== undefined) {
                          // Calculate focal point as percentage of image dimensions
                          return `${hotspot.xNorm * 100}% ${hotspot.yNorm * 100}%`;
                        }
                      }

                      // Default to center if no hotspots
                      return "50% 50%";
                    })(),
                  }}
                >
                  <img
                    src={steps[selectedStepIndex]?.screenshotUrl}
                    alt={`Step ${selectedStepIndex + 1}`}
                    onLoad={(e) => {
                      setImageLoading(false);
                      try {
                        const img = e.currentTarget as HTMLImageElement;
                        const w = img.naturalWidth || img.width || 0;
                        const h = img.naturalHeight || img.height || 0;
                        if (w > 0 && h > 0) setNaturalSize({ w, h });
                      } catch {}
                    }}
                    onError={() => setImageLoading(false)}
                    className={`select-none ${
                      imageLoading ? "opacity-50" : "opacity-100"
                    }`}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              </div>
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

          {!isPreviewing &&
            !isCurrentLeadStep &&
            currentHotspots.map((hotspot) => {
              const containerRect = imageRef.current?.getBoundingClientRect();
              let centerX = 0;
              let centerY = 0;
              const zoomLevel = (steps[selectedStepIndex]?.zoom || 100) / 100;

              if (hotspot.xNorm !== undefined && hotspot.yNorm !== undefined && containerRect && naturalSize) {
                const rr = computeRenderRect(containerRect.width, containerRect.height, naturalSize.w, naturalSize.h);

                // Calculate base position
                const baseX = rr.x + hotspot.xNorm * rr.w;
                const baseY = rr.y + hotspot.yNorm * rr.h;

                // Apply zoom offset to align with zoomed image
                // The image scales from its transform-origin, so we need to calculate the offset
                const transformOrigin = (() => {
                  const currentHotspots = currentStepId ? (hotspotsByStep[currentStepId] ?? []) : [];
                  if (currentHotspots.length > 0 && naturalSize) {
                    const originHotspot = currentHotspots[0];
                    if (originHotspot.xNorm !== undefined && originHotspot.yNorm !== undefined) {
                      return {
                        x: rr.x + originHotspot.xNorm * rr.w,
                        y: rr.y + originHotspot.yNorm * rr.h
                      };
                    }
                  }
                  // Default to center
                  return { x: containerRect.width / 2, y: containerRect.height / 2 };
                })();

                // Calculate zoomed position
                centerX = transformOrigin.x + (baseX - transformOrigin.x) * zoomLevel;
                centerY = transformOrigin.y + (baseY - transformOrigin.y) * zoomLevel;
              } else if (typeof hotspot.x === "number" && typeof hotspot.y === "number") {
                centerX = hotspot.x + (hotspot.width || 0) / 2;
                centerY = hotspot.y + (hotspot.height || 0) / 2;
              }
              const dotSize = Math.max(6, Math.min(48, Number(hotspot.dotSize ?? 12)));
              const offsetXNorm: number | undefined = (hotspot as any).tooltipOffsetXNorm;
              const offsetYNorm: number | undefined = (hotspot as any).tooltipOffsetYNorm;
              const renderRect = naturalSize ?
                computeRenderRect(
                  imageRef.current!.clientWidth,
                  imageRef.current!.clientHeight,
                  naturalSize.w,
                  naturalSize.h
                ) : { w: 0, h: 0 };

              const tooltipLeft =
                typeof offsetXNorm === "number" && naturalSize
                  ? centerX + offsetXNorm * renderRect.w * zoomLevel
                  : centerX + dotSize + 6;
              const tooltipTop =
                typeof offsetYNorm === "number" && naturalSize
                  ? centerY + offsetYNorm * renderRect.h * zoomLevel
                  : centerY - 8;
              const color = hotspot.dotColor || "#2563eb";
              const anim = hotspot.animation || "none";
              const animStyle: React.CSSProperties =
                anim === "pulse"
                  ? {} // Tailwind's animate-pulse class below
                  : anim === "breathe"
                    ? { animation: "propels-breathe 1.8s ease-in-out infinite" }
                    : anim === "fade"
                      ? { animation: "propels-fade 1.4s ease-in-out infinite" }
                      : {};
              return (
                <div key={hotspot.id}>
                  <div
                    className={`absolute rounded-full shadow cursor-grab active:cursor-grabbing ${anim === "pulse" ? "animate-pulse" : ""}`}
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
                    <TooltipEditor
                      hotspotId={hotspot.id}
                      title={tooltipTitle}
                      description={tooltipDescription}
                      onTitleChange={setTooltipTitle}
                      onDescriptionChange={setTooltipDescription}
                      onSubmit={handleTooltipSubmit}
                      onCancel={() => {
                        setEditingTooltip(null);
                        setTooltipTitle("");
                        setTooltipDescription("");
                      }}
                      style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
                    />
                  )}

                  {editingTooltip !== hotspot.id &&
                    hotspot.tooltip &&
                    (() => {
                      // Parse tooltip for display - support both string and object format
                      const tooltipData =
                        typeof hotspot.tooltip === "string"
                          ? { title: "", description: hotspot.tooltip }
                          : {
                              title: hotspot.tooltip.title || "",
                              description: hotspot.tooltip.description || hotspot.tooltip.text || "",
                            };
                      const hasTitle = tooltipData.title.trim().length > 0;

                      return (
                        <div
                          className="absolute rounded py-2 px-3 shadow-lg max-w-sm break-words cursor-grab active:cursor-grabbing"
                          style={{
                            left: `${tooltipLeft}px`,
                            top: `${tooltipTop}px`,
                            backgroundColor: hotspot.tooltipBgColor || tooltipStyle.tooltipBgColor || "#2563eb",
                            color: hotspot.tooltipTextColor || tooltipStyle.tooltipTextColor || "#ffffff",
                          }}
                          onMouseDown={(e) => {
                            // Enable dragging bubble in edit mode (not preview)
                            if (isPreviewing) return;
                            e.stopPropagation();
                            // Prevent text/image selection while dragging the bubble
                            e.preventDefault();
                            try {
                              document.body.style.userSelect = "none";
                              document.body.style.cursor = "grabbing";
                            } catch {}
                            const rect = imageRef.current?.getBoundingClientRect();
                            if (!rect || !naturalSize) return;
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startLeft = tooltipLeft;
                            const startTop = tooltipTop;
                            const boxRect = computeRenderRect(rect.width, rect.height, naturalSize.w, naturalSize.h);
                            const zoomLevel = (steps[selectedStepIndex]?.zoom || 100) / 100;
                            const onMove = (ev: MouseEvent) => {
                              const dx = ev.clientX - startX;
                              const dy = ev.clientY - startY;
                              const newLeft = startLeft + dx;
                              const newTop = startTop + dy;
                              const dxNorm = (newLeft - centerX) / (boxRect.w * zoomLevel);
                              const dyNorm = (newTop - centerY) / (boxRect.h * zoomLevel);
                              setHotspotsByStep((prev) => {
                                const list = Array.isArray(prev[currentStepId!]) ? [...prev[currentStepId!]] : [];
                                const idx = list.findIndex((h) => h.id === hotspot.id);
                                if (idx === -1) return prev;
                                const existing = list[idx] as any;
                                list[idx] = { ...existing, tooltipOffsetXNorm: dxNorm, tooltipOffsetYNorm: dyNorm };
                                return { ...prev, [currentStepId!]: list } as any;
                              });
                            };
                            const onUp = () => {
                              document.removeEventListener("mousemove", onMove);
                              document.removeEventListener("mouseup", onUp);
                              // Restore selection and cursor after bubble drag ends
                              try {
                                document.body.style.userSelect = "";
                                document.body.style.cursor = "";
                              } catch {}
                            };
                            document.addEventListener("mousemove", onMove);
                            document.addEventListener("mouseup", onUp);
                          }}
                        >
                          {hasTitle && (
                            <div
                              className="font-semibold mb-1"
                              style={{
                                fontSize: `${Number(hotspot.tooltipTextSizePx || tooltipStyle.tooltipTextSizePx || 12) + 2}px`,
                              }}
                            >
                              {tooltipData.title}
                            </div>
                          )}
                          <div
                            className="whitespace-pre-wrap break-words"
                            style={{
                              fontSize: `${Number(hotspot.tooltipTextSizePx || tooltipStyle.tooltipTextSizePx || 12)}px`,
                            }}
                          >
                            {tooltipData.description}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              );
            })}
        </div>
      </div>
      {/* Auth dialog */}
      <Dialog
        open={authOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAuthOpen(false);
            setSavingDemo(false);
          }
        }}
      >
        <DialogContent showCloseButton={true} className="p-0">
          <PasswordlessAuth
            isInDialog
            hasAnonymousSession
            onAuthSuccess={async () => {
              const draft = pendingDraftRef.current;
              setAuthOpen(false);
              setSavingDemo(true);
              const toastId = toast.loading("Saving your demo…");
              try {
                const { demoId, stepCount } = await syncAnonymousDemo(draft ? { inlineDraft: draft } : undefined);
                toast.success("Demo saved", { description: `${stepCount} steps uploaded.` });
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

      {/* Share dialog after publish */}
      <UIDialog open={shareOpen} onOpenChange={setShareOpen}>
        <UIDialogContent className="p-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your demo is live! What’s next?</h3>
            <div className="text-sm space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">1.</span>
                    <span>Copy the embed code and add it to your site</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                      onClick={() => {
                        const demoId = demoIdParam;
                        if (!demoId) {
                          alert("Save your demo first to preview in blog.");
                          return;
                        }
                        const url = `/preview-blog?demoId=${encodeURIComponent(demoId)}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      title="Preview embed"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                      onClick={async () => {
                        try {
                          const code = demoIdParam
                            ? `<iframe src="${window.location.origin}/embed/${demoIdParam}?ar=16:9" style="width:100%;aspect-ratio:16/9;border:0;" allow="fullscreen"></iframe>`
                            : "";
                          await navigator.clipboard.writeText(code);
                          toast.success("Embed code copied");
                        } catch {}
                      }}
                      title="Copy embed code"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  className="mt-2 w-full border rounded px-2 py-1 text-xs font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                  value={
                    demoIdParam
                      ? `<iframe src="${window.location.origin}/embed/${demoIdParam}?ar=16:9" style="width:100%;aspect-ratio:16/9;border:0;" allow="fullscreen"></iframe>`
                      : ""
                  }
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">2.</span>
                    <span>Or share the public viewing link</span>
                  </div>
                  <button
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                    onClick={async () => {
                      try {
                        const url = demoIdParam ? `${window.location.origin}/p/${demoIdParam}` : "";
                        await navigator.clipboard.writeText(url);
                        toast.success("Public link copied");
                      } catch {}
                    }}
                    title="Copy public link"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <input
                  readOnly
                  className="mt-2 w-full border rounded px-2 py-1 text-xs"
                  value={demoIdParam ? `${window.location.origin}/p/${demoIdParam}` : ""}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            </div>
            <div className="text-right">
              <button className="text-sm px-3 py-1.5 rounded border bg-white" onClick={() => setShareOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      <DeleteDemoModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteDemo}
        demoName={demoName && demoName.trim() && demoName !== "Untitled Demo" ? demoName : "Untitled Demo"}
      />

      {/* Lightweight template picker actions */}
      <></>
    </div>
  );
}

export default DemoEditorPage;
