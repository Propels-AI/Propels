import React from "react";
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
    <>
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={demoName}
          placeholder="Untitled Demo"
          onChange={(e) => onChangeName(e.target.value)}
          className="h-8 text-sm w-64"
        />
        {demoId && (
          <button
            onClick={() => onSaveTitle()}
            disabled={!!savingTitle || !!savingDemo}
            className={`text-sm py-1.5 px-2 rounded border ${savingTitle ? "opacity-60" : ""}`}
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
                className={`px-2 py-1 rounded text-xs font-medium ${
                  demoStatus === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {demoStatus}
              </span>
              <button
                onClick={() => onToggleStatus()}
                disabled={!!togglingStatus || !!savingDemo}
                className={`text-sm py-1.5 px-2 rounded border bg-white hover:bg-gray-50 ${
                  togglingStatus ? "opacity-60" : ""
                }`}
              >
                {demoStatus === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={() => onDelete()}
                disabled={!!deleting || !!savingDemo}
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
          onClick={() => onOpenBlogPreview()}
          className={`text-sm py-2 px-3 rounded border bg-white border-gray-300`}
          title="Open blog preview"
        >
          Blog Preview
        </button>
        {demoId && demoStatus === "PUBLISHED" && (
          <>
            <button
              onClick={() => onCopyPublicUrl()}
              className="text-sm py-2 px-3 rounded border bg-white border-gray-300"
              title="Copy public page URL"
            >
              Copy URL
            </button>
            <button
              onClick={() => onCopyEmbed()}
              className="text-sm py-2 px-3 rounded border bg-white border-gray-300"
              title="Copy iframe embed code"
            >
              Copy Embed
            </button>
          </>
        )}
        <button
          onClick={() => onSave()}
          disabled={!!savingDemo}
          className={`text-sm py-2 px-3 rounded ${
            savingDemo ? "bg-blue-400 cursor-not-allowed text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {savingDemo ? "Saving..." : "Save"}
        </button>

        {loadingSteps && <span className="text-xs text-gray-400">Loading steps…</span>}
        {!loadingSteps && stepsCount > 0 && (
          <span className="text-xs text-gray-600">Loaded {stepsCount} captured steps</span>
        )}
        {isPreviewing && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={onPrevPreview} className="text-sm py-1 px-2 rounded border bg-white border-gray-300">
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
            <button onClick={onNextPreview} className="text-sm py-1 px-2 rounded border bg-white border-gray-300">
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
