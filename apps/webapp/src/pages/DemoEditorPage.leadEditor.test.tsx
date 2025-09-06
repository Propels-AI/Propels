import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn().mockResolvedValue(undefined),
  deletePublicDemoItems: vi.fn().mockResolvedValue(undefined),
}));

const api = async () => await import("@/lib/api/demos");
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

  it("allows owner to toggle fields and persists config on Save", async () => {
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

    // Wait for editor to load lead form section
    await waitFor(() => expect(screen.getByText(/Lead Form/i)).toBeInTheDocument());

    // Enable Name field
    const nameToggle = screen.getByLabelText(/Name/i) as HTMLInputElement;
    if (!nameToggle.checked) fireEvent.click(nameToggle);

    // Disable Position if enabled by default (should be off initially, but robust to future defaults)
    const positionToggle = screen.getByLabelText(/Position/i) as HTMLInputElement;
    if (positionToggle.checked) fireEvent.click(positionToggle);

    // Save using the header Save button
    const saveButtons = await screen.findAllByRole("button", { name: /^Save$/ });
    const headerSave = saveButtons[0];
    fireEvent.click(headerSave);

    await waitFor(async () => {
      expect((await api()).updateDemoLeadConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          demoId: "demo-1",
        })
      );
    });
  });
});
