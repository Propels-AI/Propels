import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicDemoPlayer from "./PublicDemoPlayer";

vi.mock("@/lib/api/demos", () => ({
  listPublicDemoItems: vi.fn(),
  listPrivateDemoItemsPublic: vi.fn(),
  createLeadSubmissionPublic: vi.fn(),
}));

vi.mock("aws-amplify/storage", () => ({
  getUrl: vi.fn().mockResolvedValue({ url: new URL("https://cdn.example.com/img.png") }),
}));

const api = async () => await import("@/lib/api/demos");
const listPublicDemoItems = async () =>
  (await import("@/lib/api/demos")).listPublicDemoItems as unknown as ReturnType<typeof vi.fn>;
const listPrivateDemoItemsPublic = async () =>
  (await import("@/lib/api/demos")).listPrivateDemoItemsPublic as unknown as ReturnType<typeof vi.fn>;

const origError = console.error;
const origWarn = console.warn;
const origDebug = console.debug;

describe("Public lead capture", () => {
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

  it("viewer sees lead form and can submit email", async () => {
    (await listPublicDemoItems())!.mockResolvedValue([
      {
        itemSK: "METADATA",
        name: "Published Demo",
        leadStepIndex: 0, // show lead overlay as first display index
        leadConfig: { bg: "white" },
      },
      {
        itemSK: "STEP#s1",
        order: 0,
        s3Key: "owner/demo/s1.png",
        pageUrl: "https://example.com/1",
        hotspots: [{ id: "h1", width: 10, height: 10 }],
      },
    ]);

    renderAt("demo-lead");

    // Lead overlay should be visible with the CTA button
    await waitFor(() => expect(screen.getByRole("button", { name: /notify me/i })).toBeInTheDocument());

    // Fill email and submit
    const email = screen.getByPlaceholderText(/name@example\.com/i) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "viewer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /notify me/i }));

    await waitFor(async () => {
      expect((await api()).createLeadSubmissionPublic).toHaveBeenCalledWith(
        expect.objectContaining({
          demoId: "demo-lead",
          email: "viewer@example.com",
          source: "public",
        })
      );
    });

    // Confirmation message appears
    await waitFor(() => expect(screen.getByText(/we'll be in touch shortly/i)).toBeInTheDocument());
  });
});
