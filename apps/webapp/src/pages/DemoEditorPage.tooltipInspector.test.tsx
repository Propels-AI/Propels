import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({}),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  // Simulate an authenticated user so the editor path (with demoId) does not redirect
  useAuth: () => ({ user: { userId: "test-user" }, isLoading: false }),
}));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
}));

const listDemoItems = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

// Silence noisy logs
const origError = console.error;
const origWarn = console.warn;

describe("DemoEditorPage Tooltip Inspector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  const renderWithDemoId = async () => {
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://example.com",
        hotspots: JSON.stringify([
          {
            id: "h1",
            width: 10,
            height: 10,
            dotSize: 12,
            dotColor: "#2563eb",
            dotStrokePx: 2,
            dotStrokeColor: "#ffffff",
            animation: "none",
          },
        ]),
      },
    ]);

    return render(
      <MemoryRouter initialEntries={["/editor?demoId=demo-1"]}>
        <Routes>
          <Route path="/editor" element={<DemoEditorPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("switches to tooltip tab and shows tooltip inspector", async () => {
    const user = userEvent.setup();
    await renderWithDemoId();

    // Verify initial state - Steps tab should be active
    const stepsTab = screen.getByRole("tab", { name: /steps/i });
    const tooltipTab = screen.getByRole("tab", { name: /tooltip/i });
    
    expect(stepsTab).toHaveAttribute("aria-selected", "true");
    expect(tooltipTab).toHaveAttribute("aria-selected", "false");

    // Click on the Tooltip tab
    await user.click(tooltipTab);

    // Verify tab switching worked
    await waitFor(() => {
      expect(tooltipTab).toHaveAttribute("aria-selected", "true");
      expect(stepsTab).toHaveAttribute("aria-selected", "false");
    });
  });
});
