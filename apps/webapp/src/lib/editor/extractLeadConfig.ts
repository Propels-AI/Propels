export type LeadConfig = { style: "solid"; bg: "white" | "black" } & Record<string, any>;

export function extractLeadConfig(
  steps: Array<{ isLeadCapture?: boolean; leadBg?: "white" | "black" }>,
  fullLeadFormConfig?: any
): { leadStepIndex: number | null; leadConfig: LeadConfig | undefined } {
  const leadIdx = steps.findIndex((s) => Boolean(s?.isLeadCapture));
  if (leadIdx < 0) return { leadStepIndex: null, leadConfig: undefined };
  const bg: "white" | "black" = steps[leadIdx]?.leadBg === "black" ? "black" : "white";
  if (fullLeadFormConfig && typeof fullLeadFormConfig === "object") {
    const merged = {
      ...fullLeadFormConfig,
      bg,
      style: (fullLeadFormConfig as any).style ?? "solid",
    } as any;
    return { leadStepIndex: leadIdx, leadConfig: merged };
  }
  // Fallback minimal
  return { leadStepIndex: leadIdx, leadConfig: { style: "solid", bg } as any };
}
