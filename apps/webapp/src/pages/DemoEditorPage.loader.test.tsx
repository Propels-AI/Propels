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
  // Simulate an authenticated user so the editor route with demoId renders
  useAuth: () => ({ user: { userId: "test-user" }, isLoading: false }),
}));

vi.mock("@/lib/api/demos", () => ({
  listDemoItems: vi.fn(),
}));

const listDemoItems = async () =>
  (await import("@/lib/api/demos")).listDemoItems as unknown as ReturnType<typeof vi.fn>;

// Silence console noise from the component under test
const origError = console.error;
const origWarn = console.warn;

describe("DemoEditorPage loader behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  const renderWithDemoId = (demoId: string) => {
    return render(
      <MemoryRouter initialEntries={[`/editor?demoId=${demoId}`]}>
        <Routes>
          <Route path="/editor" element={<DemoEditorPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("hydrates tooltipStyle from METADATA.hotspotStyle when present", async () => {
    const user = userEvent.setup();
    (await listDemoItems())!.mockResolvedValue([
      {
        itemSK: "METADATA",
        name: "Demo A",
        status: "DRAFT",
        hotspotStyle: JSON.stringify({
          dotSize: 18,
          dotColor: "#123456",
          dotStrokePx: 3,
          dotStrokeColor: "#abcdef",
          animation: "pulse",
        }),
      },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://ex.com",
        hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]),
      },
    ]);

    renderWithDemoId("demo-1");

    // Switch to Tooltip tab to access the tooltip inspector
    const tooltipTab = screen.getByRole("tab", { name: /tooltip/i });
    await user.click(tooltipTab);

    // Wait for tab content to be visible and check tooltip controls
    await waitFor(() => {
      expect(screen.getByText(/global styling/i)).toBeInTheDocument();
    });

    // Size display should reflect 18 px
    await waitFor(() => expect(screen.getByText(/18 px/i)).toBeInTheDocument());

    // Animation combobox reflects pulse
    const label = screen.getByText(/Animation/i);
    const combobox = label.parentElement!.querySelector("[role='combobox']") as HTMLButtonElement;
    expect(combobox).toBeInTheDocument();
    expect(combobox.textContent).toBe("Pulse");
  });
});
