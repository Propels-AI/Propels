import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

// Mocks
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({}),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { userId: "user-1" } }),
}));

// Mock extractLeadConfig to simulate a lead step being present after redirect/editing
vi.mock("@/lib/editor/extractLeadConfig", () => ({
  extractLeadConfig: vi.fn().mockReturnValue({
    leadStepIndex: 1,
    leadConfig: { bg: "white" },
  }),
}));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn().mockResolvedValue(undefined),
  deletePublicDemoItems: vi.fn().mockResolvedValue(undefined),
  setDemoStatus: vi.fn().mockResolvedValue(undefined),
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

describe("DemoEditorPage publish flow", () => {
  beforeEach(() => {
    // Do not call restoreAllMocks() here because it can reset hoisted vi.mock() module factories
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  it("persists lead config before publishing (DRAFT -> PUBLISHED)", async () => {
    // Private items: DRAFT metadata + one step
    (await listDemoItemsMock())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo Draft", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        order: 0,
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
      {
        itemSK: "STEP#s2",
        s3Key: "https://cdn.example.com/s2.png",
        pageUrl: "https://example.com/2",
        order: 1,
        hotspots: JSON.stringify([{ id: "h2", width: 10, height: 10 }]),
      },
    ]);

    renderWith("demo-draft");

    // Wait for the main Save button to appear (not "Save Title")
    await waitFor(() => {
      const saveButtons = screen.getAllByRole("button", { name: /Save/ });
      const mainSaveButton = saveButtons.find((btn) => btn.textContent === "Save");
      expect(mainSaveButton).toBeInTheDocument();
    });

    // Wait for the actions menu to appear and click it
    const user = userEvent.setup();
    const dropdownBtn = await screen.findByTestId("actions-menu");
    await user.click(dropdownBtn);

    // Wait a bit for the dropdown to open
    await waitFor(() => {
      expect(screen.getByText(/Publish/i)).toBeInTheDocument();
    });

    // Find and click the Publish button
    const publishBtn = screen.getByText(/Publish/i);
    await user.click(publishBtn);

    await waitFor(async () => {
      const { updateDemoLeadConfig, setDemoStatus } = await api();
      expect(updateDemoLeadConfig).toHaveBeenCalledWith(
        expect.objectContaining({ demoId: "demo-draft", leadStepIndex: 1 })
      );
      expect(setDemoStatus).toHaveBeenCalledWith("demo-draft", "PUBLISHED");

      // Ensure ordering: lead config persisted before status toggle
      const leadCall = (updateDemoLeadConfig as any).mock.invocationCallOrder[0];
      const statusCall = (setDemoStatus as any).mock.invocationCallOrder[0];
      expect(leadCall).toBeLessThan(statusCall);
    });
  });

  it("unpublishes without error (PUBLISHED -> DRAFT)", async () => {
    (await listDemoItemsMock())!.mockResolvedValue([{ itemSK: "METADATA", name: "Demo Pub", status: "PUBLISHED" }]);

    renderWith("demo-pub");

    // Open dropdown menu to access status and unpublish button
    const user = userEvent.setup();
    const dropdownBtn = await screen.findByTestId("actions-menu");
    await user.click(dropdownBtn);

    // Wait for dropdown content to appear
    await waitFor(() => {
      expect(screen.getByText(/PUBLISHED/i)).toBeInTheDocument();
      expect(screen.getByText(/Unpublish/i)).toBeInTheDocument();
    });

    const unpublishBtn = screen.getByText(/Unpublish/i);
    await user.click(unpublishBtn);

    await waitFor(async () => {
      const { setDemoStatus } = await api();
      expect(setDemoStatus).toHaveBeenCalledWith("demo-pub", "DRAFT");
    });
  });
});
