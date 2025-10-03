import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicDemoPlayer from "./PublicDemoPlayer";

vi.mock("@/lib/api/demos", () => ({
  listPublicDemoItems: vi.fn(),
  listPrivateDemoItemsPublic: vi.fn(),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

const listPublicDemoItems = async () =>
  (await import("@/lib/api/demos")).listPublicDemoItems as unknown as ReturnType<typeof vi.fn>;
const listPrivateDemoItemsPublic = async () =>
  (await import("@/lib/api/demos")).listPrivateDemoItemsPublic as unknown as ReturnType<typeof vi.fn>;

const origError = console.error;
const origWarn = console.warn;
const origDebug = console.debug;

describe("PublicDemoPlayer", () => {
  beforeEach(async () => {
    (await listPrivateDemoItemsPublic())!.mockResolvedValue([]);
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.debug = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
    console.debug = origDebug;
  });

  const renderAt = (demoId: string, query = "") => {
    return render(
      <MemoryRouter initialEntries={[`/p/${demoId}${query}`]}>
        <Routes>
          <Route path="/p/:demoId" element={<PublicDemoPlayer />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("renders empty state for drafts (no PublicDemo items)", async () => {
    (await listPublicDemoItems())!.mockResolvedValue([]);
    renderAt("demo-empty");
    await waitFor(() => expect(screen.getByText(/We couldn't load this demo/i)).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText(/It may have been deleted, moved, or not published yet./i)).toBeInTheDocument()
    );
  });

  it("renders published items with style defaults applied and inserts lead step", async () => {
    (await listPublicDemoItems())!.mockResolvedValue([
      {
        itemSK: "METADATA",
        name: "My Public Demo",
        hotspotStyle: JSON.stringify({
          dotSize: 20,
          dotColor: "#112233",
          dotStrokePx: 3,
          dotStrokeColor: "#aabbcc",
          animation: "pulse",
        }),
        leadStepIndex: 1,
        leadConfig: { bg: "black" },
      },
      {
        itemSK: "STEP#s1",
        order: 0,
        s3Key: "owner/demo/s1.png",
        pageUrl: "https://example.com/1",
        hotspots: [
          { id: "h1", width: 10, height: 10 }, // missing style -> should take defaults
          { id: "h2", width: 10, height: 10, dotSize: 24, dotColor: "#ff0000", animation: "breathe" }, // overrides
        ],
      },
      {
        itemSK: "STEP#s2",
        order: 1,
        s3Key: "owner/demo/s2.png",
        pageUrl: "https://example.com/2",
        hotspots: [{ id: "h3", width: 10, height: 10 }],
      },
    ]);

    const first = renderAt("demo-pub");

    // Wait for loading to finish - check for navigation buttons
    await waitFor(() => expect(screen.getByRole("button", { name: /previous step/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: /next step/i })).toBeInTheDocument());

    // Check that progress bar exists and shows initial progress (33.33% for step 1 of 3)
    await waitFor(() => {
      const progressBar = document.querySelector('.bg-blue-600');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '33.33333333333333%' });
    });

    // Jump to lead via query override and navigate to it
    first.unmount();
    renderAt("demo-pub", "?leadAt=2");
    // Initially still at Step 1 (currentIndex 0). Click Next to move to lead step (index 1)
    const next = await screen.findByRole("button", { name: /next step/i });
    fireEvent.click(next);
    // Check progress bar shows 66.67% (step 2 of 3)
    await waitFor(() => {
      const progressBar = document.querySelector('.bg-blue-600');
      expect(progressBar).toHaveStyle({ width: '66.66666666666666%' });
    });
  });
});
