import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));
vi.mock("@/lib/providers/AuthProvider", () => ({ useAuth: () => ({ user: { userId: "user-1" } }) }));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn().mockResolvedValue(undefined),
  deletePublicDemoItems: vi.fn().mockResolvedValue(undefined),
}));

const listDemoItems = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

describe("DemoEditorPage lead form editor", () => {
  const origError = console.error;
  const origWarn = console.warn;
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  const renderWith = (demoId: string) =>
    render(
      <MemoryRouter initialEntries={[`/editor?demoId=${demoId}`]}>
        <Routes>
          <Route path="/editor" element={<DemoEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

  it("switches to lead form tab successfully", async () => {
    const user = userEvent.setup();
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    renderWith("demo-1");

    // Verify initial state - Steps tab should be active
    const stepsTab = screen.getByRole("tab", { name: /steps/i });
    const leadTab = screen.getByRole("tab", { name: /lead form/i });
    
    expect(stepsTab).toHaveAttribute("aria-selected", "true");
    expect(leadTab).toHaveAttribute("aria-selected", "false");

    // Click on the Lead Form tab
    await user.click(leadTab);

    // Verify tab switching worked
    await waitFor(() => {
      expect(leadTab).toHaveAttribute("aria-selected", "true");
      expect(stepsTab).toHaveAttribute("aria-selected", "false");
    });
  });

  it("verifies all three tabs are present and functional", async () => {
    const user = userEvent.setup();
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    renderWith("demo-1");

    // Verify all tabs are present
    const stepsTab = screen.getByRole("tab", { name: /steps/i });
    const tooltipTab = screen.getByRole("tab", { name: /tooltip/i });
    const leadFormTab = screen.getByRole("tab", { name: /lead form/i });
    
    expect(stepsTab).toBeInTheDocument();
    expect(tooltipTab).toBeInTheDocument();
    expect(leadFormTab).toBeInTheDocument();

    // Test switching between tabs
    await user.click(tooltipTab);
    await waitFor(() => {
      expect(tooltipTab).toHaveAttribute("aria-selected", "true");
    });

    await user.click(leadFormTab);
    await waitFor(() => {
      expect(leadFormTab).toHaveAttribute("aria-selected", "true");
    });

    await user.click(stepsTab);
    await waitFor(() => {
      expect(stepsTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
