import { describe, it, expect } from "vitest";
import { extractLeadConfig, type LeadConfig } from "./extractLeadConfig";

describe("extractLeadConfig", () => {
  it("returns null/undefined when there is no lead step", () => {
    const steps = [
      { isLeadCapture: false },
      { isLeadCapture: undefined },
      {},
    ];
    const res = extractLeadConfig(steps);
    expect(res.leadStepIndex).toBeNull();
    expect(res.leadConfig).toBeUndefined();
  });

  it("defaults to white bg when leadBg is missing or invalid", () => {
    const steps = [
      { isLeadCapture: false },
      { isLeadCapture: true, leadBg: "purple" },
    ];
    // Intentionally pass a wider-typed array to simulate invalid input
    const res = extractLeadConfig(steps as any);
    expect(res.leadStepIndex).toBe(1);
    expect(res.leadConfig).toEqual<LeadConfig>({ style: "solid", bg: "white" });
  });

  it("returns black bg when leadBg === 'black'", () => {
    const steps = [
      { isLeadCapture: true, leadBg: "black" as const },
      { isLeadCapture: false },
    ];
    const res = extractLeadConfig(steps);
    expect(res.leadStepIndex).toBe(0);
    expect(res.leadConfig).toEqual<LeadConfig>({ style: "solid", bg: "black" });
  });

  it("picks the first lead step when multiple marked", () => {
    const steps = [
      { isLeadCapture: false },
      { isLeadCapture: true, leadBg: "white" as const },
      { isLeadCapture: true, leadBg: "black" as const },
    ];
    const res = extractLeadConfig(steps);
    expect(res.leadStepIndex).toBe(1);
    expect(res.leadConfig).toEqual<LeadConfig>({ style: "solid", bg: "white" });
  });
});
