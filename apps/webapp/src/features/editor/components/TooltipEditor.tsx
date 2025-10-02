import type React from "react";
import { Input } from "@/components/ui/input";

interface TooltipEditorProps {
  hotspotId: string;
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (id: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}

export const TooltipEditor: React.FC<TooltipEditorProps> = ({
  hotspotId,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
  style,
}) => {
  return (
    <div
      className="absolute bg-background border border-border rounded-lg shadow-xl min-w-[320px] animate-in fade-in-0 zoom-in-95 duration-200"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-4 space-y-3">
        <Input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const descField = e.currentTarget.parentElement?.querySelector("textarea");
              if (descField) (descField as HTMLTextAreaElement).focus();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          className="text-sm font-medium"
          autoFocus
        />
        <textarea
          placeholder="Add a description..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(hotspotId);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none transition-all placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border rounded-b-lg">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-background border border-border rounded">
              Enter
            </kbd>
            <span>to save</span>
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-background border border-border rounded">
              Shift
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-background border border-border rounded">
              Enter
            </kbd>
            <span>for new line</span>
          </span>
        </div>
        <button
          onClick={() => onSubmit(hotspotId)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Save
        </button>
      </div>
    </div>
  );
};
