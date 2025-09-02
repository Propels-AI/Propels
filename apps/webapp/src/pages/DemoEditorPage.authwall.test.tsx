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

// Unauthenticated user
vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

// Replace PasswordlessAuth to a marker so we can assert it's shown
vi.mock("@/components/auth/PasswordlessAuth", () => ({
  PasswordlessAuth: () => <div data-testid="auth-wall">Auth Wall</div>,
}));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
  updateDemoStepHotspots: vi.fn().mockResolvedValue(undefined),
  updateDemoStyleConfig: vi.fn().mockResolvedValue(undefined),
  updateDemoLeadConfig: vi.fn().mockResolvedValue(undefined),
  mirrorDemoToPublic: vi.fn(),
  deletePublicDemoItems: vi.fn(),
}));

const api = async () => await import("@/lib/api/demos");
const listDemoItemsMock = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

const origError = console.error;
const origWarn = console.warn;

describe("DemoEditorPage unauthenticated save shows auth wall and avoids public writes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  it("shows PasswordlessAuth on save and does not call mirror/deletePublic", async () => {
    (await listDemoItemsMock())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Draft Demo", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/editor?demoId=demo-unauth"]}>
        <Routes>
          <Route path="/editor" element={<DemoEditorPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for main Save button to indicate editor UI is ready
    await screen.findAllByRole("button", { name: /^Save$/ });

    // Click the header Save button (there may be another 'Save' inside the tooltip inspector)
    const [saveHeader] = screen.getAllByRole("button", { name: /^Save$/ });
    fireEvent.click(saveHeader);

    // Auth wall must be visible
    await waitFor(() => expect(screen.getByTestId("auth-wall")).toBeInTheDocument());

    // Ensure no public write APIs were called in unauth save attempt
    expect((await api()).mirrorDemoToPublic).not.toHaveBeenCalled();
    expect((await api()).deletePublicDemoItems).not.toHaveBeenCalled();
  });
});
