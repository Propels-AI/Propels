import React from "react";

export function StepsBar(props: {
  total: number;
  current: number;
  onSelect?: (index: number) => void;
  leadIndex?: number | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const { total, current, onSelect, leadIndex = null, className, size = "md" } = props;
  if (!Number.isFinite(total) || total <= 0) return null;

  const circleSize = size === "sm" ? 20 : 28; // px
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className={`w-full flex items-center gap-2 ${className || ""}`} aria-label="Steps navigation">
      {Array.from({ length: total }).map((_, idx) => {
        const isCurrent = idx === current;
        const isCompleted = idx < current;
        const isLead = leadIndex !== null && idx === leadIndex;
        const canClick = typeof onSelect === "function";
        const baseColor = isCurrent
          ? "bg-blue-600 text-white"
          : isCompleted
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-200 text-gray-700";
        const ring = isCurrent ? "ring-2 ring-blue-300" : "";
        return (
          <React.Fragment key={idx}>
            <button
              type="button"
              className={`shrink-0 rounded-full flex items-center justify-center ${baseColor} ${ring}`}
              style={{ width: circleSize, height: circleSize }}
              onClick={canClick ? () => onSelect && onSelect(idx) : undefined}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={isLead ? `Lead step ${idx + 1}` : `Step ${idx + 1}`}
            >
              <span className={`${textSize} font-medium`}>{isLead ? "L" : idx + 1}</span>
            </button>
            {idx < total - 1 && (
              <div className="flex-1 h-0.5 bg-gray-200">
                <div
                  className="h-0.5 bg-blue-400"
                  style={{ width: `${Math.max(0, Math.min(100, (Math.min(current, idx + 1) / (idx + 1)) * 100))}%` }}
                  aria-hidden
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default StepsBar;
