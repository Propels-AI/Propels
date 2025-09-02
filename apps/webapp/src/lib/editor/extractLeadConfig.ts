export type LeadConfig = { style: "solid"; bg: "white" | "black" };

export function extractLeadConfig(
  steps: Array<{ isLeadCapture?: boolean; leadBg?: "white" | "black" }>
): { leadStepIndex: number | null; leadConfig: LeadConfig | undefined } {
  const leadIdx = steps.findIndex((s) => Boolean(s?.isLeadCapture));
  if (leadIdx < 0) return { leadStepIndex: null, leadConfig: undefined };
  const bg: "white" | "black" = steps[leadIdx]?.leadBg === "black" ? "black" : "white";
  return {
    leadStepIndex: leadIdx,
    leadConfig: { style: "solid", bg },
  };
}
