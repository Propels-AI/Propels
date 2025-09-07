import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));
vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));
vi.mock("@/lib/providers/AuthProvider", () => ({ useAuth: () => ({ user: { userId: "user-1" } }) }));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn().mockResolvedValue(undefined),
  deletePublicDemoItems: vi.fn().mockResolvedValue(undefined),
}));

const api = async () => await import("@/lib/api/demos");
const listDemoItems = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

describe("DemoEditorPage bubble drag", () => {
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

  it("updates hotspot offsets when dragging tooltip text then saves", async () => {
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([
          { id: "h1", width: 10, height: 10, xNorm: 0.4, yNorm: 0.4, dotSize: 12, tooltip: "Hello" },
        ]),
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/editor?demoId=drag-demo"]}>
        <Routes>
          <Route path="/editor" element={<DemoEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Ensure image sizing is available for normalized math
    const img = await screen.findByAltText(/Step 1/i);
    Object.defineProperty(img, "naturalWidth", { value: 800, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 600, configurable: true });
    fireEvent.load(img);

    // Wait for bubble text to appear (non-preview edit mode renders bubble)
    const bubble = await screen.findByText(/Hello/i);

    // Start drag on bubble and move right by 50px
    fireEvent.mouseDown(bubble, { clientX: 400, clientY: 300 });
    fireEvent.mouseMove(document, { clientX: 450, clientY: 300 });
    fireEvent.mouseUp(document);

    // Save via header Save button
    const [saveHeader] = await screen.findAllByRole("button", { name: /^Save$/ });
    fireEvent.click(saveHeader);

    await waitFor(async () => {
      const mod = (await api()) as any;
      const calls = (mod.updateDemoStepHotspots as Mock).mock.calls as any[];
      expect(calls.length).toBeGreaterThan(0);
      const match = calls.find((c: any[]) => {
        const hs = c?.[0]?.hotspots;
        const s = Array.isArray(hs) ? JSON.stringify(hs) : String(hs);
        return /tooltipOffsetXNorm/.test(s);
      });
      expect(match).toBeTruthy();
    });
  });
});
