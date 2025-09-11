import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy, Link, Upload, Trash2, Edit3, Check } from "lucide-react";
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
  isPreviewing: boolean;
  previewableCount: number;
  currentPreviewIndex: number;
  onSelectPreviewIndex: (index: number) => void;
  onPrevPreview: () => void;
  onNextPreview: () => void;
  // actions
  onSaveTitle: (newTitle?: string) => Promise<void> | void;
  onPreview: () => void;
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
    isPreviewing,
    previewableCount,
    currentPreviewIndex,
    onSelectPreviewIndex,
    onPrevPreview,
    onNextPreview,
    onSaveTitle,
    onPreview,
    onToggleStatus,
    onDelete,
    onOpenBlogPreview,
    onCopyPublicUrl,
    onCopyEmbed,
    onSave,
  } = props;

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleEditTitle = () => {
    // If it's "Untitled Demo" or empty, start with empty input, otherwise use current name
    const currentValue = !demoName || demoName === "Untitled Demo" ? "" : demoName;
    setEditingTitleValue(currentValue);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    const newTitle = editingTitleValue.trim() || "Untitled Demo";
    onChangeName(newTitle);
    setIsEditingTitle(false);

    // Pass the new title directly to onSaveTitle
    if (demoId) {
      await onSaveTitle(newTitle);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditingTitleValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div className="font-sans">
      {/* Single Row Header: Title on left, Actions on right */}
      <div className="mb-4 flex items-center justify-between">
        {/* Left: Demo Title Section */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <>
              <Input
                ref={inputRef}
                value={editingTitleValue}
                placeholder="Enter demo name"
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCancelEdit}
                className="h-8 text-sm w-64 font-sans border border-border focus-visible:border-ring focus-visible:ring-0"
              />
              <Button
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur when clicking save
                  handleSaveTitle();
                }}
                disabled={!!savingTitle || !!savingDemo}
                variant="outline"
                size="sm"
                className={`font-sans ${savingTitle ? "opacity-60" : ""}`}
                data-testid="title-save-button"
              >
                {savingTitle ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-medium text-foreground font-sans">{demoName || "Untitled Demo"}</h1>
              {demoId && (
                <Button
                  onClick={handleEditTitle}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 font-sans hover:bg-accent"
                  title="Edit demo name"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Primary Actions - Swapped order: Preview first, then Save */}
          <Button onClick={() => onPreview()} variant="outline" className="font-sans">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>

          <Button
            onClick={() => onSave()}
            disabled={!!savingDemo}
            className={`font-sans ${
              savingDemo
                ? "bg-primary/60 cursor-not-allowed text-primary-foreground"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {savingDemo ? "Saving..." : "Save"}
          </Button>

          {/* Secondary Actions Menu */}
          {demoId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-sans" data-testid="actions-menu">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* Status Badge */}
                <div className="px-2 py-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                      demoStatus === "PUBLISHED"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-secondary/10 text-secondary border-secondary/20"
                    }`}
                  >
                    {demoStatus}
                  </span>
                </div>

                <DropdownMenuSeparator />

                {/* Publishing Actions */}
                <DropdownMenuItem
                  onClick={() => onToggleStatus()}
                  disabled={!!togglingStatus || !!savingDemo}
                  className="font-sans"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {demoStatus === "PUBLISHED" ? "Unpublish" : "Publish"}
                </DropdownMenuItem>

                {demoStatus === "PUBLISHED" && (
                  <>
                    <DropdownMenuItem onClick={() => onCopyPublicUrl()} className="font-sans">
                      <Link className="h-4 w-4 mr-2" />
                      Copy URL
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => onCopyEmbed()} className="font-sans">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Embed
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Blog Preview */}
                    <DropdownMenuItem onClick={() => onOpenBlogPreview()} className="font-sans">
                      <Eye className="h-4 w-4 mr-2" />
                      Blog Preview
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Destructive Actions */}
                <DropdownMenuItem
                  onClick={() => onDelete()}
                  disabled={!!deleting || !!savingDemo}
                  className="font-sans text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Preview Navigation (when in preview mode) */}
      {isPreviewing && (
        <div className="mb-4 flex items-center justify-center gap-3">
          <Button onClick={onPrevPreview} variant="outline" size="sm" className="font-sans">
            Prev
          </Button>
          <div className="w-64">
            <StepsBar
              total={previewableCount}
              current={currentPreviewIndex}
              onSelect={onSelectPreviewIndex}
              className="mx-auto"
              size="sm"
            />
          </div>
          <Button onClick={onNextPreview} variant="outline" size="sm" className="font-sans">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
