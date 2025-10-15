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

  // Determine which steps to show with "..." abstraction
  const getVisibleSteps = () => {
    const maxVisible = 6; // Maximum number of step circles to show
    const buffer = 1; // Show 1 step before and after current

    if (total <= maxVisible) {
      // Show all steps if total is small
      return Array.from({ length: total }, (_, i) => i);
    }

    const visible = new Set<number>();

    // Always show first step
    visible.add(0);

    // Always show last step
    visible.add(total - 1);

    // Always show lead step if it exists
    if (leadIndex !== null && leadIndex >= 0 && leadIndex < total) {
      visible.add(leadIndex);
    }

    // Show steps around current step
    const start = Math.max(0, current - buffer);
    const end = Math.min(total - 1, current + buffer);
    for (let i = start; i <= end; i++) {
      visible.add(i);
    }

    // Convert to sorted array
    const result = Array.from(visible).sort((a, b) => a - b);

    // Add "..." markers by checking gaps
    const withDots = [];
    for (let i = 0; i < result.length; i++) {
      const step = result[i];
      withDots.push(step);

      // Add "..." if there's a gap to the next step
      if (i < result.length - 1) {
        const nextStep = result[i + 1];
        if (nextStep - step > 1) {
          withDots.push(null); // null represents "..."
        }
      }
    }

    return withDots;
  };

  const visibleSteps = getVisibleSteps();

  const renderStepCircle = (idx: number) => {
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
    );
  };

  const renderDots = () => (
    <span
      className={`${textSize} font-medium text-gray-500 px-1`}
      style={{ width: circleSize, height: circleSize }}
      aria-hidden="true"
    >
      ...
    </span>
  );

  return (
    <div className={`w-full flex items-center gap-2 ${className || ""}`} aria-label="Steps navigation">
      {visibleSteps.map((step, index) => (
        <React.Fragment key={step !== null ? `step-${step}` : `dots-${index}`}>
          {step === null ? (
            renderDots()
          ) : (
            <>
              {renderStepCircle(step)}
              {index < visibleSteps.length - 1 && visibleSteps[index + 1] !== null && (
                <div className="flex-1 h-0.5 bg-gray-200">
                  <div
                    className="h-0.5 bg-blue-400"
                    style={{
                      width: step < current
                        ? "100%"
                        : step === current
                          ? "0%"
                          : "0%"
                    }}
                    aria-hidden
                  />
                </div>
              )}
            </>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default StepsBar;
