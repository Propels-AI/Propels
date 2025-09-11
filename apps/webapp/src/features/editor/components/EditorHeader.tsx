import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy, Link, Upload, Trash2 } from "lucide-react";
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
  onSaveTitle: () => Promise<void> | void;
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

  return (
    <div className="font-sans">
      {/* Demo Title Section */}
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={demoName}
          placeholder="Untitled Demo"
          onChange={(e) => onChangeName(e.target.value)}
          className="h-8 text-sm w-64 font-sans"
        />
        {demoId && (
          <Button
            onClick={() => onSaveTitle()}
            disabled={!!savingTitle || !!savingDemo}
            variant="outline"
            size="sm"
            className={`font-sans ${savingTitle ? "opacity-60" : ""}`}
          >
            {savingTitle ? "Saving..." : "Save Title"}
          </Button>
        )}
      </div>

      {/* Actions Section */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Primary Actions */}
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

          <Button onClick={() => onPreview()} variant="outline" className="font-sans">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>

        <div className="flex items-center gap-3">
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
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Blog Preview */}
                <DropdownMenuItem onClick={() => onOpenBlogPreview()} className="font-sans">
                  <Eye className="h-4 w-4 mr-2" />
                  Blog Preview
                </DropdownMenuItem>

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
