import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncAnonymousDemo, type EditedDraft } from "./syncAnonymousDemo";

// Mocks for external modules used by syncAnonymousDemo
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn(),
}));

vi.mock("../api/demos", () => ({
  getOwnerId: vi.fn(),
  createDemoMetadata: vi.fn(),
  createDemoStep: vi.fn(),
}));

vi.mock("../services/s3Service", () => ({
  uploadStepImage: vi.fn(),
}));

// Helpers to access mocks with types
const getOwnerId = async () => (await import("../api/demos")).getOwnerId as unknown as ReturnType<typeof vi.fn>;
const createDemoMetadata = async () =>
  (await import("../api/demos")).createDemoMetadata as unknown as ReturnType<typeof vi.fn>;
const createDemoStep = async () => (await import("../api/demos")).createDemoStep as unknown as ReturnType<typeof vi.fn>;
const fetchAuthSession = async () =>
  (await import("aws-amplify/auth")).fetchAuthSession as unknown as ReturnType<typeof vi.fn>;
const uploadStepImage = async () =>
  (await import("../services/s3Service")).uploadStepImage as unknown as ReturnType<typeof vi.fn>;

// Minimal fake base64 png (small and safe for tests)
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P8z8BQDwAFKQImf0G3NwAAAABJRU5ErkJggg==";

describe("syncAnonymousDemo integration (mocked)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock chrome runtime
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: vi.fn(),
      },
    };
  });

  it("throws when unauthenticated then succeeds after sign-in and preserves edits", async () => {
    const inlineDraft: EditedDraft = {
      draftId: "draft-1",
      createdAt: new Date().toISOString(),
      name: "My Demo",
      steps: [
        { id: "s1", pageUrl: "https://example.com", order: 0 },
      ],
      hotspotsByStep: {
        s1: [
          {
            id: "h1",
            width: 10,
            height: 10,
            xNorm: 0.5,
            yNorm: 0.5,
            tooltip: "Hello",
            dotSize: 16,
            dotColor: "#f00",
            dotStrokePx: 1,
            dotStrokeColor: "#0f0",
            animation: "pulse",
          } as any,
        ],
      },
    };

    // Initial unauthenticated state: getOwnerId returns undefined
    (await getOwnerId())!.mockResolvedValue(undefined);

    // Ensure captures are present so the function reaches the auth check and fails there
    ;(globalThis as any).chrome.runtime.sendMessage.mockImplementation((_extId: string, msg: any) => {
      if (msg?.type === "GET_CAPTURE_SESSION") {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: "s1",
              screenshotDataUrl: tinyPng,
              pageUrl: "https://example.com",
            },
          ],
        });
      }
      return Promise.resolve({ success: true });
    });

    await expect(syncAnonymousDemo({ inlineDraft, extensionId: "ext-1" })).rejects.toThrow(/Not signed in/i);

    // Now simulate signed-in state
    (await getOwnerId())!.mockResolvedValue("user-123");
    (await fetchAuthSession())!.mockResolvedValue({ identityId: "ap-southeast-1:abc-def" } as any);

    // Mock extension captures (again for the successful path)
    ;(globalThis as any).chrome.runtime.sendMessage.mockImplementation((_extId: string, msg: any) => {
      if (msg?.type === "GET_CAPTURE_SESSION") {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: "s1",
              screenshotDataUrl: tinyPng,
              pageUrl: "https://example.com",
            },
          ],
        });
      }
      if (msg?.type === "CLEAR_CAPTURE_SESSION") {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });

    // Mock storage upload
    ;(await uploadStepImage())!.mockResolvedValue({ s3Key: "owner/demo/s1.png", publicUrl: "https://cdn/s1.png" });

    // Track calls to metadata and step creation
    const metaMock = (await createDemoMetadata())!;
    const stepMock = (await createDemoStep())!;
    metaMock.mockResolvedValue(undefined);
    stepMock.mockResolvedValue(undefined);

    const res = await syncAnonymousDemo({ inlineDraft, extensionId: "ext-1" });
    expect(res.stepCount).toBe(1);

    // Metadata created with user ownerId
    expect(metaMock).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user-123", name: "My Demo", status: "DRAFT" })
    );

    // Step created with preserved hotspots from draft
    expect(stepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: "s1",
        hotspots: inlineDraft.hotspotsByStep.s1,
        order: 0,
        pageUrl: "https://example.com",
      })
    );
  });
});
