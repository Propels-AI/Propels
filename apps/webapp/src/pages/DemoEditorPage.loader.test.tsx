import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DemoEditorPage } from "./DemoEditorPage";

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({}),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
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
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT", hotspotStyle: JSON.stringify({ dotSize: 18, dotColor: "#123456", dotStrokePx: 3, dotStrokeColor: "#abcdef", animation: "pulse" }) },
      { itemSK: "STEP#s1", s3Key: "https://cdn.example.com/s1.png", pageUrl: "https://ex.com", hotspots: JSON.stringify([{ id: "h1", width: 10, height: 10 }]) },
    ]);

    renderWithDemoId("demo-1");

    // Size display should reflect 18 px
    await waitFor(() => expect(screen.getByText(/18 px/i)).toBeInTheDocument());

    // We avoid asserting specific color inputs here to keep this test resilient to UI structure.

    // Animation select reflects pulse
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("pulse");
  });

  it("derives tooltipStyle from first hotspot when METADATA.hotspotStyle is missing", async () => {
    (await listDemoItems())!.mockResolvedValue([
      { itemSK: "METADATA", name: "Demo A", status: "DRAFT" },
      {
        itemSK: "STEP#s1",
        s3Key: "https://cdn.example.com/s1.png",
        pageUrl: "https://ex.com",
        hotspots: JSON.stringify([
          { id: "h1", width: 10, height: 10, dotSize: 22, dotColor: "#654321", dotStrokePx: 4, dotStrokeColor: "#fedcba", animation: "breathe" },
        ]),
      },
    ]);

    renderWithDemoId("demo-2");

    await waitFor(() => expect(screen.getByText(/22 px/i)).toBeInTheDocument());
    // Skip color input assertions to avoid coupling to UI details.

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("breathe");
  });
});
