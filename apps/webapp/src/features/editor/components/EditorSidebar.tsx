import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import LeadFormEditor from "@/features/editor/components/LeadFormEditor";
import { type TooltipStyle } from "@/lib/editor/deriveTooltipStyleFromHotspots";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
}: EditorSidebarProps) {
  const [leadUiOpen, setLeadUiOpen] = React.useState(false);
  const [leadInsertAnchor, setLeadInsertAnchor] = React.useState(1);
  const [leadInsertPos, setLeadInsertPos] = React.useState<"before" | "after">("after");
  const [inspectorTab, setInspectorTab] = React.useState<"fill" | "stroke">("fill");

  const animationOptions = [
    { value: "none", label: "None" },
    { value: "pulse", label: "Pulse" },
    { value: "breathe", label: "Breathe" },
    { value: "fade", label: "Fade" },
  ];

  return (
    <div
      className={`${isCollapsed ? "w-12" : "w-80"} bg-muted/30 border-r border-border font-sans transition-all duration-300 ease-in-out relative`}
    >
      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleCollapse}
        className="absolute top-4 right-2 z-10 h-8 w-8 p-0 hover:bg-accent"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Sidebar Content */}
      <div className={`${isCollapsed ? "hidden" : "block"} p-4`}>
        <Tabs defaultValue="steps" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="tooltip">Tooltip</TabsTrigger>
            <TabsTrigger value="lead">Lead Form</TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="space-y-4">
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
                        // This should be handled by parent component
                        // For now, we'll call a hypothetical onAddLeadStep
                        console.log("Add lead step at index:", insertIndex);
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
                <button
                  key={s.id}
                  onClick={() => onSelectStep(idx)}
                  className={`w-full flex gap-3 items-center bg-card p-2 rounded-lg shadow border text-left hover:border-primary ${
                    idx === selectedStepIndex ? "border-primary" : "border-transparent"
                  }`}
                >
                  {s.isLeadCapture ? (
                    <div
                      className={`w-16 h-12 rounded flex items-center justify-center text-[10px] border ${
                        s.leadBg === "black" ? "bg-black text-white" : "bg-white text-gray-700"
                      }`}
                    >
                      LEAD
                    </div>
                  ) : (
                    <img src={s.screenshotUrl} alt="thumb" className="w-16 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Step {idx + 1}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.isLeadCapture ? "Lead capture" : s.pageUrl}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tooltip" className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Tooltip Inspector</h3>
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

                {inspectorTab === "fill" ? (
                  <>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Size (px)</label>
                      <input
                        type="range"
                        min={6}
                        max={48}
                        step={1}
                        value={Number(tooltipStyle.dotSize)}
                        onChange={(e) => applyGlobalStyle({ dotSize: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="text-[10px] text-muted-foreground mt-0.5">{Number(tooltipStyle.dotSize)} px</div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Color</label>
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
                      <label className="block text-xs text-muted-foreground mb-1">Width (px)</label>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={1}
                        value={Number(tooltipStyle.dotStrokePx)}
                        onChange={(e) => applyGlobalStyle({ dotStrokePx: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {Number(tooltipStyle.dotStrokePx)} px
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Color</label>
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
                  <label className="block text-xs text-muted-foreground mb-1">Tooltip background</label>
                  <input
                    type="color"
                    value={tooltipStyle.tooltipBgColor || "#2563eb"}
                    onChange={(e) => applyGlobalStyle({ tooltipBgColor: e.target.value })}
                    className="w-10 h-8 p-0 border rounded"
                    title="Choose tooltip background"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tooltip text color</label>
                  <input
                    type="color"
                    value={tooltipStyle.tooltipTextColor || "#ffffff"}
                    onChange={(e) => applyGlobalStyle({ tooltipTextColor: e.target.value })}
                    className="w-10 h-8 p-0 border rounded"
                    title="Choose tooltip text color"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tooltip text size (px)</label>
                  <input
                    type="range"
                    min={8}
                    max={24}
                    step={1}
                    value={Number(tooltipStyle.tooltipTextSizePx || 12)}
                    onChange={(e) => applyGlobalStyle({ tooltipTextSizePx: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {Number(tooltipStyle.tooltipTextSizePx || 12)} px
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Animation (applies to all steps)</label>
                  <Combobox
                    options={animationOptions}
                    value={tooltipStyle.animation}
                    onValueChange={(value) => applyGlobalStyle({ animation: value as any })}
                    placeholder="Select animation..."
                    className="w-full"
                  />
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
          </TabsContent>

          <TabsContent value="lead" className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground font-sans">Lead Form Editor</h3>
            <LeadFormEditor leadFormConfig={leadFormConfig} setLeadFormConfig={setLeadFormConfig} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
