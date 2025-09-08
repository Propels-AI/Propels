import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({}),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  // DemoEditorPage determines auth via `!!user?.userId || !!user?.username`
  useAuth: () => ({ user: { userId: "user-1" } }),
}));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn().mockResolvedValue(undefined),
  deletePublicDemoItems: vi.fn().mockResolvedValue(undefined),
}));

const api = async () => await import("@/lib/api/demos");
const listDemoItemsMock = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

const origError = console.error;
const origWarn = console.warn;

const renderWith = (demoId: string) =>
  render(
    <MemoryRouter initialEntries={[`/editor?demoId=${demoId}`]}>
      <Routes>
        <Route path="/editor" element={<DemoEditorPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("DemoEditorPage save flow (draft vs published)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  it("DRAFT: saves privately and deletes any public items (no mirror)", async () => {
    (await listDemoItemsMock())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    renderWith("demo-draft");

    // Ensure UI and steps loaded
    await screen.findAllByRole("button", { name: /^Save$/ });
    await screen.findByText(/Step\s*1/i);

    // Click the header Save button (there may be another 'Save' inside the tooltip inspector)
    const [saveHeader] = screen.getAllByRole("button", { name: /^Save$/ });
    fireEvent.click(saveHeader);

    await waitFor(async () => {
      expect((await api()).updateDemoStyleConfig).toHaveBeenCalled();
      expect((await api()).updateDemoLeadConfig).toHaveBeenCalled();
      expect((await api()).updateDemoStepHotspots).toHaveBeenCalled();
      expect((await api()).deletePublicDemoItems).toHaveBeenCalled();
      expect((await api()).mirrorDemoToPublic).not.toHaveBeenCalled();
    });
  });

  it("PUBLISHED: mirrors to PublicDemo on save", async () => {
    (await listDemoItemsMock())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "PUBLISHED", hotspotStyle: JSON.stringify({ dotSize: 18 }) },
      {
        itemSK: "STEP#s1",
        order: 0,
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    renderWith("demo-pub");

    // Ensure UI loaded (published badge & Save visible) and steps rendered
    await waitFor(() => expect(screen.getByText(/PUBLISHED/i)).toBeInTheDocument());
    await screen.findAllByRole("button", { name: /^Save$/ });
    await screen.findByText(/Step\s*1/i);

    const [saveHeader] = screen.getAllByRole("button", { name: /^Save$/ });
    fireEvent.click(saveHeader);

    await waitFor(async () => {
      expect((await api()).mirrorDemoToPublic).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // No lead step was inserted in this scenario, so null is expected
          leadStepIndex: null,
          name: "Demo A",
        })
      );
      expect((await api()).deletePublicDemoItems).not.toHaveBeenCalled();
    });
  });
});
