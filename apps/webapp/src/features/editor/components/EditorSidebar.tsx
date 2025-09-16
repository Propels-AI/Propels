import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";

import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import LeadFormEditor from "@/features/editor/components/LeadFormEditor";
import { type TooltipStyle } from "@/lib/editor/deriveTooltipStyleFromHotspots";
import { MousePointer2, Palette, FormInput, PanelLeft, PanelLeftClose, GripVertical, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
  steps: Array<{
    id: string;
    pageUrl: string;
    screenshotUrl?: string;
    isLeadCapture?: boolean;
    leadBg?: "white" | "black";
  }>;
  loadingSteps: boolean;
  selectedStepIndex: number;
  onSelectStep: (index: number) => void;
  currentStepId?: string;
  currentHotspots: Array<any>;
  isCurrentLeadStep: boolean;
  leadFormConfig: any;
  setLeadFormConfig: React.Dispatch<React.SetStateAction<any>>;
  tooltipStyle: TooltipStyle;
  applyGlobalStyle: (style: Partial<TooltipStyle>) => void;
  handleSave: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAddLeadStep: (insertIndex: number) => void;
  onDeleteStep: (index: number) => void;
  onDuplicateStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
}

export function EditorSidebar({
  steps,
  loadingSteps,
  selectedStepIndex,
  onSelectStep,
  currentStepId,
  currentHotspots,
  isCurrentLeadStep,
  leadFormConfig,
  setLeadFormConfig,
  tooltipStyle,
  applyGlobalStyle,
  handleSave,
  isCollapsed,
  onToggleCollapse,
  onAddLeadStep,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps,
}: EditorSidebarProps) {
  const [leadUiOpen, setLeadUiOpen] = React.useState(false);
  const [leadInsertAnchor, setLeadInsertAnchor] = React.useState(1);
  const [leadInsertPos, setLeadInsertPos] = React.useState<"before" | "after">("after");
  const [inspectorTab, setInspectorTab] = React.useState<"fill" | "stroke">("fill");
  const [globalColor, setGlobalColor] = React.useState(tooltipStyle.dotColor || "#059669");
  const [dragFromIdx, setDragFromIdx] = React.useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);
  const [dropPosition, setDropPosition] = React.useState<"before" | "after" | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const animationOptions = [
    { value: "none", label: "None" },
    { value: "pulse", label: "Pulse" },
    { value: "breathe", label: "Breathe" },
    { value: "fade", label: "Fade" },
  ];

  // Enhanced drag and drop handlers
  const handleDragStart = React.useCallback((e: React.DragEvent, index: number) => {
    setDragFromIdx(index);
    setIsDragActive(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));

    // Create a custom drag image with rotation effect
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.transform = "rotate(5deg)";
    dragImage.style.opacity = "0.8";
    dragImage.style.pointerEvents = "none";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  }, []);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (dragFromIdx === null || dragFromIdx === index) return;

      // Determine drop position based on mouse position within element
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const elementHeight = rect.height;
      const position = mouseY < elementHeight / 2 ? "before" : "after";

      setDragOverIdx(index);
      setDropPosition(position);
    },
    [dragFromIdx]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the element entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverIdx(null);
      setDropPosition(null);
    }
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (dragFromIdx === null) {
        setDragFromIdx(null);
        setDragOverIdx(null);
        setDropPosition(null);
        setIsDragActive(false);
        return;
      }

      // Calculate the actual insertion index based on drop position
      let insertIndex = dropIndex;
      if (dropPosition === "after") {
        insertIndex = dropIndex + 1;
      }

      // Adjust for the fact that we're removing an item first
      if (dragFromIdx < insertIndex) {
        insertIndex -= 1;
      }

      // Don't move if dropping in the same position
      if (dragFromIdx === insertIndex) {
        setDragFromIdx(null);
        setDragOverIdx(null);
        setDropPosition(null);
        setIsDragActive(false);
        return;
      }

      onReorderSteps(dragFromIdx, insertIndex);

      setDragFromIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      setIsDragActive(false);
    },
    [dragFromIdx, dropPosition, onReorderSteps]
  );

  const handleDragEnd = React.useCallback(() => {
    setDragFromIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
    setIsDragActive(false);
  }, []);

  return (
    <>
      <div
        className={cn(
          "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col font-sans",
          isCollapsed ? "w-0" : "w-80"
        )}
      >
        {!isCollapsed && (
          <>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-sidebar-border">
              <Tabs defaultValue="steps" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="steps" className="text-[8px] px-1 py-1">
                    <MousePointer2 className="w-3 h-3 mr-1" />
                    Steps
                  </TabsTrigger>
                  <TabsTrigger value="tooltip" className="text-[8px] px-1 py-1">
                    <Palette className="w-3 h-3 mr-1" />
                    Tooltip
                  </TabsTrigger>
                  <TabsTrigger value="lead" className="text-[8px] px-1 py-1">
                    <FormInput className="w-3 h-3 mr-1" />
                    Lead Form
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="steps" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Steps</h3>
                    <Button
                      title="Add lead generation step"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLeadUiOpen((v) => !v);
                        const safeLen = Math.max(1, steps.length);
                        const suggested = Math.min(safeLen, selectedStepIndex + 1);
                        setLeadInsertAnchor(suggested);
                        setLeadInsertPos("after");
                      }}
                    >
                      + Lead
                    </Button>
                  </div>
                  {leadUiOpen && (
                    <div className="mb-3 p-3 bg-card border border-border rounded-lg shadow-sm text-xs text-card-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Add lead form</span>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name="leadpos"
                            className="accent-primary"
                            checked={leadInsertPos === "before"}
                            onChange={() => setLeadInsertPos("before")}
                          />
                          <span>before</span>
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name="leadpos"
                            className="accent-primary"
                            checked={leadInsertPos === "after"}
                            onChange={() => setLeadInsertPos("after")}
                          />
                          <span>after</span>
                        </label>
                        <span>step</span>
                        <select
                          value={leadInsertAnchor}
                          onChange={(e) =>
                            setLeadInsertAnchor(
                              Math.max(1, Math.min(Math.max(1, steps.length), parseInt(e.target.value || "1", 10)))
                            )
                          }
                          className="bg-background border border-input text-foreground rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                        >
                          {Array.from({ length: Math.max(1, steps.length) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <div className="ml-auto flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const anchor0 = Math.max(1, Math.min(Math.max(1, steps.length), leadInsertAnchor)) - 1;
                              const insertIndex = leadInsertPos === "before" ? anchor0 : anchor0 + 1;
                              onAddLeadStep(insertIndex);
                              setLeadUiOpen(false);
                            }}
                          >
                            Insert
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setLeadUiOpen(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {steps.length === 0 && !loadingSteps && (
                      <div className="text-xs text-muted-foreground">
                        No steps yet. Try recording again, or
                        <a href="#" className="text-primary hover:underline mx-1">
                          read the guide
                        </a>
                        or
                        <a
                          href="https://cal.com/propels/demo-help"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline ml-1"
                        >
                          talk to our team
                        </a>
                        .
                      </div>
                    )}
                    {steps.map((s, idx) => (
                      <div key={s.id} className="relative">
                        {/* Drop indicator before this step */}
                        {dragOverIdx === idx &&
                          dropPosition === "before" &&
                          dragFromIdx !== null &&
                          dragFromIdx !== idx && (
                            <div className="absolute -top-2 left-0 right-0 z-20">
                              <div className="h-1 bg-primary rounded-full mx-2 shadow-lg" />
                            </div>
                          )}

                        <div
                          draggable
                          onClick={() => !isDragActive && onSelectStep(idx)}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "relative cursor-pointer transition-all duration-200 hover:shadow-md group",
                            idx === selectedStepIndex && "ring-2 ring-primary shadow-md",
                            dragFromIdx === idx && "opacity-50 scale-95 rotate-2",
                            isDragActive && dragFromIdx !== idx && "transition-transform duration-200 ease-out"
                          )}
                        >
                          {/* Slide Number Badge */}
                          <div className="absolute top-2 left-2 z-10 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-2 py-1 rounded-full border shadow-sm">
                            {idx + 1}
                          </div>
                          {/* Drag Handle */}
                          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="bg-background/90 backdrop-blur-sm p-1 rounded border shadow-sm cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3 h-3 text-muted-foreground" />
                            </div>
                          </div>

                          {/* Step Actions */}
                          <div className="absolute top-8 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-6 h-6 rounded border bg-background hover:bg-accent"
                              title="Duplicate step"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateStep(idx);
                              }}
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-6 h-6 rounded border bg-background hover:bg-accent"
                              title="Delete step"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteStep(idx);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>

                          {s.isLeadCapture ? (
                            <div
                              className={`aspect-video w-full rounded-lg flex items-center justify-center p-3 border ${
                                s.leadBg === "black" ? "bg-black text-white" : "bg-white text-gray-700"
                              }`}
                            >
                              {/* Mini Lead Form Preview */}
                              <div className="w-full max-w-[120px] space-y-2">
                                <div className="text-center">
                                  <div className="text-[8px] font-semibold mb-1">
                                    {(leadFormConfig as any)?.title || "Stay in the loop"}
                                  </div>
                                  <div className="text-[6px] opacity-70 mb-2">
                                    {(leadFormConfig as any)?.subtitle || "Leave your details"}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="h-2 bg-current/20 rounded-sm" />
                                  <div className="h-2 bg-current/20 rounded-sm w-4/5" />
                                  <div className="h-1.5 bg-current/20 rounded-sm w-3/5" />
                                </div>
                                <div className="text-center mt-2">
                                  <div className="text-[6px] px-2 py-0.5 bg-current/30 rounded-sm inline-block">
                                    {(leadFormConfig as any)?.ctaText || "Notify me"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Large Image Display */
                            <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                              <img
                                src={s.screenshotUrl || "/placeholder.svg"}
                                alt={`Slide ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>

                        {/* Drop indicator after this step */}
                        {dragOverIdx === idx &&
                          dropPosition === "after" &&
                          dragFromIdx !== null &&
                          dragFromIdx !== idx && (
                            <div className="absolute -bottom-2 left-0 right-0 z-20">
                              <div className="h-1 bg-primary rounded-full mx-2 shadow-lg" />
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="tooltip" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Global Styling</Label>
                      <div className="space-y-3 mt-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Animation</Label>
                          <Combobox
                            options={animationOptions}
                            value={tooltipStyle.animation}
                            onValueChange={(value) => applyGlobalStyle({ animation: value as any })}
                            placeholder="Select animation..."
                            className="w-full mt-2"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Dot Size</Label>
                          <input
                            type="range"
                            min={6}
                            max={48}
                            step={1}
                            value={Number(tooltipStyle.dotSize)}
                            onChange={(e) => applyGlobalStyle({ dotSize: Number(e.target.value) })}
                            className="w-full mt-2"
                          />
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {Number(tooltipStyle.dotSize)} px
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Color</Label>
                          <ColorPicker
                            value={globalColor}
                            onChange={(color: string) => {
                              setGlobalColor(color);
                              applyGlobalStyle({ dotColor: color });
                            }}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </div>

                    {isCurrentLeadStep ? (
                      <div className="text-xs text-muted-foreground">Lead capture step has no hotspots.</div>
                    ) : currentHotspots.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No tooltip on this step. Click on the image to add one.
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div className="flex gap-2 text-xs">
                          <Button
                            size="sm"
                            variant={inspectorTab === "fill" ? "default" : "outline"}
                            onClick={() => setInspectorTab("fill")}
                          >
                            Fill
                          </Button>
                          <Button
                            size="sm"
                            variant={inspectorTab === "stroke" ? "default" : "outline"}
                            onClick={() => setInspectorTab("stroke")}
                          >
                            Stroke
                          </Button>
                        </div>

                        {inspectorTab === "stroke" && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">Stroke Width</Label>
                              <input
                                type="range"
                                min={0}
                                max={8}
                                step={1}
                                value={Number(tooltipStyle.dotStrokePx)}
                                onChange={(e) => applyGlobalStyle({ dotStrokePx: Number(e.target.value) })}
                                className="w-full mt-2"
                              />
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {Number(tooltipStyle.dotStrokePx)} px
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Stroke Color</Label>
                              <input
                                type="color"
                                value={tooltipStyle.dotStrokeColor}
                                onChange={(e) => applyGlobalStyle({ dotStrokeColor: e.target.value })}
                                className="w-10 h-8 p-0 border rounded mt-2"
                                title="Choose stroke color"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">Tooltip Background</Label>
                          <input
                            type="color"
                            value={tooltipStyle.tooltipBgColor || "#2563eb"}
                            onChange={(e) => applyGlobalStyle({ tooltipBgColor: e.target.value })}
                            className="w-10 h-8 p-0 border rounded mt-2"
                            title="Choose tooltip background"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tooltip Text Color</Label>
                          <input
                            type="color"
                            value={tooltipStyle.tooltipTextColor || "#ffffff"}
                            onChange={(e) => applyGlobalStyle({ tooltipTextColor: e.target.value })}
                            className="w-10 h-8 p-0 border rounded mt-2"
                            title="Choose tooltip text color"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tooltip Text Size</Label>
                          <input
                            type="range"
                            min={8}
                            max={24}
                            step={1}
                            value={Number(tooltipStyle.tooltipTextSizePx || 12)}
                            onChange={(e) => applyGlobalStyle({ tooltipTextSizePx: Number(e.target.value) })}
                            className="w-full mt-2"
                          />
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {Number(tooltipStyle.tooltipTextSizePx || 12)} px
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button onClick={handleSave} size="sm">
                            Save
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (!currentStepId) return;
                              // This should be handled by parent component
                              console.log("Delete tooltip for step:", currentStepId);
                            }}
                          >
                            Delete Tooltip
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="lead" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Lead Form Editor</Label>
                    <LeadFormEditor leadFormConfig={leadFormConfig} setLeadFormConfig={setLeadFormConfig} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>

      {/* Improved Collapse Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-8 rounded-r-md border border-l-0 bg-background hover:bg-accent"
        style={{ left: isCollapsed ? "0px" : "320px" }}
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <PanelLeft className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
      </Button>
    </>
  );
}
