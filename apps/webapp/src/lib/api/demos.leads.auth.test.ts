import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("aws-amplify/data", () => {
  const generateClient = vi.fn(() => ({
    models: {
      Demo: {
        get: vi.fn(() => ({ data: { ownerId: "owner-A" } })),
      },
      LeadSubmission: {
        list: vi.fn(() => ({ data: [] })),
      },
    },
  }));
  return { generateClient };
});

vi.mock("aws-amplify/auth", () => {
  return {
    getCurrentUser: vi.fn(),
  };
});

describe("listLeadSubmissions ownership checks", () => {
  const realConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = realConsoleError;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("throws 403 when current user is not the demo owner", async () => {
    const { getCurrentUser }: any = await import("aws-amplify/auth");
    getCurrentUser.mockResolvedValue({ username: "owner-B", userId: "owner-B" });
    const mod = await import("./demos");
    await expect(mod.listLeadSubmissions("demo-123")).rejects.toMatchObject({ message: expect.stringMatching(/Forbidden/i), status: 403 });
  });

  it("proceeds when current user matches the owner", async () => {
    const { getCurrentUser }: any = await import("aws-amplify/auth");
    getCurrentUser.mockResolvedValue({ username: "owner-A", userId: "owner-A" });
    const mod = await import("./demos");
    const res = await mod.listLeadSubmissions("demo-123");
    expect(Array.isArray(res)).toBe(true);
  });
});
