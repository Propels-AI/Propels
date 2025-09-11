import { Input } from "@/components/ui/input";
import StepsBar from "@/components/StepsBar";

export type EditorHeaderProps = {
  demoId?: string;
  demoName: string;
  onChangeName: (name: string) => void;
  savingTitle: boolean;
  savingDemo: boolean;
  demoStatus: "DRAFT" | "PUBLISHED";
  togglingStatus: boolean;
  deleting: boolean;
  loadingSteps: boolean;
  stepsCount: number;
  isPreviewing: boolean;
  previewableCount: number;
  currentPreviewIndex: number;
  onSelectPreviewIndex: (index: number) => void;
  onPrevPreview: () => void;
  onNextPreview: () => void;
  // actions
  onSaveTitle: () => Promise<void> | void;
  onToggleStatus: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onOpenBlogPreview: () => void;
  onCopyPublicUrl: () => Promise<void> | void;
  onCopyEmbed: () => Promise<void> | void;
  onSave: () => Promise<void> | void;
};

export default function EditorHeader(props: EditorHeaderProps) {
  const {
    demoId,
    demoName,
    onChangeName,
    savingTitle,
    savingDemo,
    demoStatus,
    togglingStatus,
    deleting,
    loadingSteps,
    stepsCount,
    isPreviewing,
    previewableCount,
    currentPreviewIndex,
    onSelectPreviewIndex,
    onPrevPreview,
    onNextPreview,
    onSaveTitle,
    onToggleStatus,
    onDelete,
    onOpenBlogPreview,
    onCopyPublicUrl,
    onCopyEmbed,
    onSave,
  } = props;

  return (
    <div className="font-sans">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={demoName}
          placeholder="Untitled Demo"
          onChange={(e) => onChangeName(e.target.value)}
          className="h-8 text-sm w-64 font-sans"
        />
        {demoId && (
          <button
            onClick={() => onSaveTitle()}
            disabled={!!savingTitle || !!savingDemo}
            className={`text-sm py-1.5 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans ${savingTitle ? "opacity-60" : ""}`}
          >
            {savingTitle ? "Saving..." : "Save Title"}
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3">
        {demoId && (
          <>
            <div className="flex items-center gap-2 mr-4">
              <span
                className={`px-2 py-1 rounded-md text-xs font-medium font-sans border ${
                  demoStatus === "PUBLISHED"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-secondary/10 text-secondary border-secondary/20"
                }`}
              >
                {demoStatus}
              </span>
              <button
                onClick={() => onToggleStatus()}
                disabled={!!togglingStatus || !!savingDemo}
                className={`text-sm py-1.5 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans ${
                  togglingStatus ? "opacity-60" : ""
                }`}
              >
                {demoStatus === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={() => onDelete()}
                disabled={!!deleting || !!savingDemo}
                className={`text-sm py-1.5 px-3 rounded-md border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans ${
                  deleting ? "opacity-70" : ""
                }`}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => onOpenBlogPreview()}
          className="text-sm py-2 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans"
          title="Open blog preview"
        >
          Blog Preview
        </button>
        {demoId && demoStatus === "PUBLISHED" && (
          <>
            <button
              onClick={() => onCopyPublicUrl()}
              className="text-sm py-2 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans"
              title="Copy public page URL"
            >
              Copy URL
            </button>
            <button
              onClick={() => onCopyEmbed()}
              className="text-sm py-2 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans"
              title="Copy iframe embed code"
            >
              Copy Embed
            </button>
          </>
        )}
        <button
          onClick={() => onSave()}
          disabled={!!savingDemo}
          className={`text-sm py-2 px-3 rounded-md transition-colors font-sans focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none ${
            savingDemo
              ? "bg-primary/60 cursor-not-allowed text-primary-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
        >
          {savingDemo ? "Saving..." : "Save"}
        </button>

        {loadingSteps && <span className="text-xs text-muted-foreground font-sans">Loading steps…</span>}
        {!loadingSteps && stepsCount > 0 && (
          <span className="text-xs text-muted-foreground font-sans">Loaded {stepsCount} captured steps</span>
        )}
        {isPreviewing && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onPrevPreview}
              className="text-sm py-1 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans"
            >
              Prev
            </button>
            <div className="w-64">
              <StepsBar
                total={previewableCount}
                current={currentPreviewIndex}
                onSelect={onSelectPreviewIndex}
                className="mx-auto"
                size="sm"
              />
            </div>
            <button
              onClick={onNextPreview}
              className="text-sm py-1 px-3 rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none transition-colors font-sans"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
