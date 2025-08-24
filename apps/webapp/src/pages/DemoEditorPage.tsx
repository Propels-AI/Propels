import React, { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { syncAnonymousDemo, type EditedDraft } from "../lib/services/syncAnonymousDemo";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useSearchParams } from "react-router-dom";
import { listDemoItems, renameDemo, setDemoStatus as setDemoStatusApi, deleteDemo } from "@/lib/api/demos";
import { getUrl } from "aws-amplify/storage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";

export function DemoEditorPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user?.userId || !!user?.username;
  const [searchParams] = useSearchParams();
  const demoIdParam = searchParams.get("demoId") || undefined;
  const [loadingSteps, setLoadingSteps] = useState<boolean>(false);
  const [steps, setSteps] = useState<
    Array<{
      id: string;
      pageUrl: string;
      screenshotUrl: string;
      // coordinate metadata for pre-placement (normalized preferred)
      xNorm?: number;
      yNorm?: number;
      clickX?: number;
      clickY?: number;
      viewportWidth?: number;
      viewportHeight?: number;
    }>
  >([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [authOpen, setAuthOpen] = useState(false);
  const pendingDraftRef = useRef<EditedDraft | null>(null);
  // Metadata for saved demo (when demoId exists)
  const [demoName, setDemoName] = useState<string>("");
  const [demoStatus, setDemoStatusLocal] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [savingTitle, setSavingTitle] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  type Hotspot = {
    id: string;
    // Absolute pixel coords kept for backward-compat; prefer normalized below
    x?: number;
    y?: number;
    width: number;
    height: number;
    // Preferred: normalized position within the image (0..1), independent of container size
    xNorm?: number;
    yNorm?: number;
    tooltip?: string;
  };
  const [hotspotsByStep, setHotspotsByStep] = useState<Record<string, Hotspot[]>>({});
  const [editingTooltip, setEditingTooltip] = useState<string | null>(null);
  const [tooltipText, setTooltipText] = useState("");
  const imageRef = useRef<HTMLDivElement>(null);
  // Helper: compute rendered image rect within container for object-contain
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
  const [annotationMode, setAnnotationMode] = useState<boolean>(true);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  // Track container size so we re-render hotspots on resize
  const [, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const currentStepId = steps[selectedStepIndex]?.id;
  const currentHotspots: Hotspot[] = currentStepId ? (hotspotsByStep[currentStepId] ?? []) : [];

  useEffect(() => {
    console.log("[Editor] mounted", { demoIdParam, isAuthenticated });
  }, [demoIdParam, isAuthenticated]);

  // Load natural dimensions of the current screenshot so the container can match it
  useEffect(() => {
    const url = steps[selectedStepIndex]?.screenshotUrl;
    if (!url) {
      setNaturalSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setNaturalSize(null);
    img.src = url;
  }, [steps, selectedStepIndex]);

  useEffect(() => {
    // If a demoId is provided, load saved steps from backend
    const loadFromBackend = async (demoId: string) => {
      try {
        setLoadingSteps(true);
        console.log("[Editor] Loading demo from backend", { demoId });
        const items = await listDemoItems(demoId);
        console.log("[Editor] listDemoItems returned", { count: items?.length, items });
        // Extract metadata
        const meta = (items || []).find((it: any) => String(it.itemSK) === "METADATA");
        if (meta) {
          setDemoName(meta.name || "");
          setDemoStatusLocal((meta.status as any) === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
        }
        const stepItems = (items || []).filter((it: any) => String(it.itemSK || "").startsWith("STEP#"));
        stepItems.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        console.log("[Editor] stepItems", { count: stepItems.length, stepItems });
        const urls: Array<{
          id: string;
          pageUrl: string;
          screenshotUrl: string;
        }> = [];
        const hotspotsMap: Record<string, Hotspot[]> = {};
        for (const si of stepItems) {
          try {
            const path: string | undefined = si.s3Key;
            if (!path) continue;
            const { url } = await getUrl({ path });
            urls.push({
              id: String(si.itemSK).slice("STEP#".length),
              pageUrl: si.pageUrl || "",
              screenshotUrl: url.toString(),
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
        setSteps(urls);
        setHotspotsByStep(hotspotsMap);
        setSelectedStepIndex(0);
      } catch (e) {
        console.error("[Editor] Failed to load demo from backend", e);
      } finally {
        setLoadingSteps(false);
      }
    };

    // If not loading existing demo, and not authenticated, attempt to load anonymous captures from extension
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
            // Sort by stepOrder then timestamp for stable order
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
                // Prefer data URL from extension serialization; fallback to Blob
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
              } catch (_e) {
                // Skip any entries that fail to convert
              }
            }
            setSteps(urls);
            setSelectedStepIndex(0);

            // Pre-place a default hotspot for each step at captured coordinates
            // Store normalized coordinates so they render correctly at any size
            (async () => {
              try {
                const DEFAULT_W = 12; // tiny dot width
                const DEFAULT_H = 12; // tiny dot height

                const initial: Record<string, Hotspot[]> = {};

                await Promise.all(
                  urls.map(
                    (s) =>
                      new Promise<void>((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                          // Determine normalized coords
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
      } finally {
        setLoadingSteps(false);
      }
    };

    if (demoIdParam) {
      loadFromBackend(demoIdParam);
    } else {
      loadFromExtension();
    }

    // Cleanup created object URLs on unmount
    return () => {
      try {
        steps.forEach((s) => URL.revokeObjectURL(s.screenshotUrl));
      } catch (_e) {}
    };
  }, [demoIdParam]);

  // Recompute container metrics on element or window resize to keep tooltip positions in sync
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
    } catch {
      // ResizeObserver might be unavailable in some environments
    }
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [selectedStepIndex, naturalSize]);

  // Allow user to exit annotation mode with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawing(false);
        setEditingTooltip(null);
        setAnnotationMode(false);
        setPreviewMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSave = async () => {
    // Build EditedDraft from current editor state
    const draft: EditedDraft = {
      draftId: (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: undefined,
      steps: steps.map((s, idx) => ({ id: s.id, pageUrl: s.pageUrl, order: idx })),
      hotspotsByStep: hotspotsByStep,
    };

    if (!isAuthenticated) {
      // Persist a small JSON draft locally and prompt for sign-up
      try {
        localStorage.setItem(`demoEditedDraft:${draft.draftId}`, JSON.stringify(draft));
        localStorage.setItem("pendingDraftId", draft.draftId);
      } catch (_) {}
      pendingDraftRef.current = draft;
      setAuthOpen(true);
      return;
    }

    // Authenticated: run sync immediately using inline draft
    try {
      const { demoId, stepCount } = await syncAnonymousDemo({ inlineDraft: draft });
      console.log("Saved demo", demoId, "with steps:", stepCount);
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Failed to save demo:", e);
      alert("Failed to save demo. Please try again.");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    // Only draw when annotation mode is enabled and we're not editing a tooltip
    if (previewMode || !annotationMode || editingTooltip) return;
    if (!currentStepId) return;
    // Enforce max 1 tooltip per step
    if (currentHotspots.length >= 1) {
      // Optionally open existing tooltip for edit
      const existing = currentHotspots[0];
      setEditingTooltip(existing.id);
      setTooltipText(existing.tooltip ?? "");
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log(`Drawing from (${startPos.x}, ${startPos.y}) to (${x}, ${y})`);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !imageRef.current) return;
    if (!currentStepId) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to normalized within the rendered image rect when possible
    let xNorm: number | undefined;
    let yNorm: number | undefined;
    try {
      const url = steps[selectedStepIndex]?.screenshotUrl;
      if (url && naturalSize) {
        const rr = computeRenderRect(rect.width, rect.height, naturalSize.w, naturalSize.h);
        if (rr.w > 0 && rr.h > 0) {
          xNorm = (x - rr.x) / rr.w;
          yNorm = (y - rr.y) / rr.h;
          // Clamp
          xNorm = Math.max(0, Math.min(1, xNorm));
          yNorm = Math.max(0, Math.min(1, yNorm));
        }
      }
    } catch (_e) {}

    const newHotspot: Hotspot = {
      id: Math.random().toString(36).substring(7),
      // Keep absolute dimensions for now; dot rendering uses normalized center
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
      xNorm,
      yNorm,
    };

    setHotspotsByStep((prev) => ({
      ...prev,
      [currentStepId]: [...(prev[currentStepId] ?? []), newHotspot],
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
    // Keep annotation mode ON; user can press Esc to exit
    // Auto-advance to next step if available
    setSelectedStepIndex((idx) => {
      const next = idx + 1;
      return next < steps.length ? next : idx;
    });
  };

  // Preview-mode helpers
  const annotatedIndices = steps.map((s, idx) => (hotspotsByStep[s.id]?.length ? idx : -1)).filter((v) => v >= 0);

  const enterPreview = () => {
    setAnnotationMode(false);
    setPreviewMode(true);
    // If current step isn't annotated, jump to first annotated
    if (currentStepId && !(hotspotsByStep[currentStepId]?.length > 0)) {
      if (annotatedIndices.length > 0) setSelectedStepIndex(annotatedIndices[0]);
    }
  };

  const exitPreview = () => {
    setPreviewMode(false);
  };

  const gotoPrevAnnotated = () => {
    if (annotatedIndices.length === 0) return;
    const pos = annotatedIndices.indexOf(selectedStepIndex);
    const prevPos = pos > 0 ? pos - 1 : 0;
    setSelectedStepIndex(annotatedIndices[prevPos]);
  };

  const gotoNextAnnotated = () => {
    if (annotatedIndices.length === 0) return;
    const pos = annotatedIndices.indexOf(selectedStepIndex);
    const nextPos = pos >= 0 && pos < annotatedIndices.length - 1 ? pos + 1 : pos;
    if (nextPos >= 0) setSelectedStepIndex(annotatedIndices[nextPos]);
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
                  disabled={savingTitle}
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
                      await setDemoStatusApi(demoIdParam, next);
                      setDemoStatusLocal(next);
                    } catch (e) {
                      console.error("Failed to update status", e);
                      alert("Failed to update status. Please try again.");
                    } finally {
                      setTogglingStatus(false);
                    }
                  }}
                  disabled={togglingStatus}
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
                  disabled={deleting}
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
            onClick={() => (previewMode ? exitPreview() : enterPreview())}
            className={`text-sm py-2 px-3 rounded border ${
              previewMode ? "bg-green-100 border-green-400" : "bg-white border-gray-300"
            }`}
            title="Toggle preview mode"
          >
            {previewMode ? "Preview: On (Esc to stop)" : "Preview: Off"}
          </button>
          <button
            onClick={() => setAnnotationMode((v) => !v)}
            className={`text-sm py-2 px-3 rounded border ${
              annotationMode ? "bg-amber-100 border-amber-400" : "bg-white border-gray-300"
            }`}
            title="Toggle annotation mode"
          >
            {annotationMode ? "Annotate: On (Esc to stop)" : "Annotate: Off"}
          </button>
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded">
            Save
          </button>
          {!isAuthenticated && (
            <span className="text-xs text-gray-500">You can freely edit. Saving requires sign in.</span>
          )}
          {loadingSteps && <span className="text-xs text-gray-400">Loading steps…</span>}
          {!loadingSteps && steps.length > 0 && (
            <span className="text-xs text-gray-600">Loaded {steps.length} captured steps</span>
          )}
          {previewMode && (
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={gotoPrevAnnotated} className="text-sm py-1 px-2 rounded border bg-white border-gray-300">
                Prev
              </button>
              <span className="text-xs text-gray-600">
                {annotatedIndices.length > 0
                  ? `${annotatedIndices.indexOf(selectedStepIndex) + 1} / ${annotatedIndices.length}`
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
          className="bg-gray-200 border rounded-xl w-full flex items-center justify-center relative overflow-hidden"
          style={
            naturalSize
              ? {
                  // Match the screenshot aspect ratio and avoid upscaling beyond its natural width
                  aspectRatio: `${naturalSize.w} / ${naturalSize.h}`,
                  width: "100%",
                  maxWidth: `${naturalSize.w}px`,
                }
              : undefined
          }
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {steps.length > 0 ? (
            <img
              src={steps[selectedStepIndex]?.screenshotUrl}
              alt={`Step ${selectedStepIndex + 1}`}
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : demoIdParam ? (
            <span className="text-gray-500 text-sm">No steps found for this demo or unable to load images.</span>
          ) : (
            <span className="text-gray-500">No captures yet</span>
          )}

          {currentHotspots.map((hotspot) => {
            // Compute dot position. Prefer normalized coords relative to current image render rect.
            const containerRect = imageRef.current?.getBoundingClientRect();
            let centerX = 0;
            let centerY = 0;
            if (hotspot.xNorm !== undefined && hotspot.yNorm !== undefined && containerRect && naturalSize) {
              const rr = computeRenderRect(containerRect.width, containerRect.height, naturalSize.w, naturalSize.h);
              centerX = rr.x + hotspot.xNorm * rr.w;
              centerY = rr.y + hotspot.yNorm * rr.h;
            } else if (typeof hotspot.x === "number" && typeof hotspot.y === "number") {
              // Fallback to absolute stored coords
              centerX = hotspot.x + (hotspot.width || 0) / 2;
              centerY = hotspot.y + (hotspot.height || 0) / 2;
            }
            const dotSize = 10; // visual size of the marker
            const tooltipLeft = centerX + dotSize + 6;
            const tooltipTop = centerY - 8;
            return (
              <div key={hotspot.id}>
                <div
                  className="absolute rounded-full bg-blue-600 border-2 border-white shadow"
                  style={{
                    left: `${centerX - dotSize / 2}px`,
                    top: `${centerY - dotSize / 2}px`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                  }}
                />

                {editingTooltip === hotspot.id && (
                  <div
                    className="absolute bg-white border rounded p-2 shadow-lg"
                    style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
                  >
                    <Input
                      type="text"
                      placeholder="Add tooltip text"
                      value={tooltipText}
                      onChange={(e) => setTooltipText(e.target.value)}
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
      <div className="w-80 bg-gray-100 p-4 border-l">
        <h2 className="text-xl font-semibold mb-4">Steps</h2>
        <div className="space-y-2">
          {steps.length === 0 && !loadingSteps && <div className="text-xs text-gray-500">No steps found</div>}
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setSelectedStepIndex(idx)}
              className={`w-full flex gap-3 items-center bg-white p-2 rounded-lg shadow border text-left hover:border-blue-500 ${
                idx === selectedStepIndex ? "border-blue-600" : "border-transparent"
              }`}
            >
              <img src={s.screenshotUrl} alt="thumb" className="w-16 h-12 object-cover rounded" />
              <div className="flex-1">
                <p className="text-sm font-medium">Step {idx + 1}</p>
                <p className="text-[10px] text-gray-500 truncate">{s.pageUrl}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent showCloseButton={true} className="p-0">
          <PasswordlessAuth
            isInDialog
            hasAnonymousSession
            onAuthSuccess={async () => {
              // After sign-in, sync using the stored draft
              const draft = pendingDraftRef.current;
              try {
                const { demoId, stepCount } = await syncAnonymousDemo(draft ? { inlineDraft: draft } : undefined);
                console.log("Saved demo", demoId, "with steps:", stepCount);
                setAuthOpen(false);
                window.location.href = "/dashboard";
              } catch (e) {
                console.error("Failed to save demo after auth:", e);
                alert("Failed to save demo after sign-in. Please try again.");
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DemoEditorPage;
