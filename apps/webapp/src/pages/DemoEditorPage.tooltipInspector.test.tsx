import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("updates UI when user changes size, color, stroke, and animation", async () => {
    await renderWithDemoId();

    // Wait for initial loader to place values
    await waitFor(() => expect(screen.getByText(/12 px/i)).toBeInTheDocument());

    // Change size to 24
    const sizeInput = screen.getAllByRole("slider")[0] as HTMLInputElement;
    fireEvent.change(sizeInput, { target: { value: "24" } });
    await waitFor(() => expect(screen.getByText(/24 px/i)).toBeInTheDocument());

    // Change fill color
    const fillColor = screen.getByTitle(/choose color/i) as HTMLInputElement;
    fireEvent.change(fillColor, { target: { value: "#112233" } });
    expect(fillColor.value.toLowerCase()).toBe("#112233");

    // Switch to Stroke tab
    fireEvent.click(screen.getByRole("button", { name: /stroke/i }));

    // Change stroke width to 3
    const strokeWidthInput = screen.getAllByRole("slider")[0] as HTMLInputElement;
    fireEvent.change(strokeWidthInput, { target: { value: "3" } });
    await waitFor(() => expect(screen.getByText(/3 px/i)).toBeInTheDocument());

    // Change stroke color
    const strokeColor = screen.getByTitle(/color/i) as HTMLInputElement;
    fireEvent.change(strokeColor, { target: { value: "#aabbcc" } });
    expect(strokeColor.value.toLowerCase()).toBe("#aabbcc");

    // Change animation select
    const label = screen.getByText(/Animation \(applies to all steps\)/i);
    const select = label.parentElement!.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "pulse" } });
    expect(select.value).toBe("pulse");
  });
});
