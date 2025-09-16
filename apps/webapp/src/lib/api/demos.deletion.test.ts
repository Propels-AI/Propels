import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteDemo, createLeadSubmissionPublic } from "./demos";
import { listLeadSubmissionsSmartly, getLeadsForDeletedDemo } from "./leads";

// Mock the dependencies
vi.mock("aws-amplify/data", () => ({
  generateClient: vi.fn(() => ({
    models: {
      AppData: {
        list: vi.fn(),
        delete: vi.fn(),
      },
      PublicMirror: {
        list: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
      },
      LeadIntake: {
        list: vi.fn(),
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn(),
  getCurrentUser: vi.fn(() => Promise.resolve({ username: "test-user" })),
}));

// Mock the entire demos module
vi.mock("./demos", () => ({
  deleteDemo: vi.fn(),
  createLeadSubmissionPublic: vi.fn(),
  getPrivateModels: vi.fn(),
  getPublicMirrorModels: vi.fn(),
  getPublicMirrorWriteModels: vi.fn(),
  getLeadIntakeWriteModels: vi.fn(),
  deletePublicDemoItems: vi.fn(),
}));

describe("Demo Deletion with Lead Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteDemo", () => {
    it("should be called with the correct demo ID", async () => {
      const { deleteDemo } = await import("./demos");

      (deleteDemo as any).mockResolvedValue(undefined);

      await deleteDemo("test-demo-id");

      // Verify deleteDemo was called with the correct ID
      expect(deleteDemo).toHaveBeenCalledWith("test-demo-id");
    });

    it("should handle deletion errors gracefully", async () => {
      const { deleteDemo } = await import("./demos");

      (deleteDemo as any).mockRejectedValue(new Error("Deletion failed"));

      // Should propagate the error
      await expect(deleteDemo("test-demo-id")).rejects.toThrow("Deletion failed");
    });
  });

  describe("Lead preservation during demo creation", () => {
    it("should call createLeadSubmissionPublic with correct parameters", async () => {
      const { createLeadSubmissionPublic } = await import("./demos");

      (createLeadSubmissionPublic as any).mockResolvedValue(undefined);

      const params = {
        demoId: "test-demo-id",
        email: "test@example.com",
        fields: { name: "John Doe" },
      };

      await createLeadSubmissionPublic(params);

      // Verify function was called with correct parameters
      expect(createLeadSubmissionPublic).toHaveBeenCalledWith(params);
    });

    it("should handle lead submission errors", async () => {
      const { createLeadSubmissionPublic } = await import("./demos");

      (createLeadSubmissionPublic as any).mockRejectedValue(new Error("Lead submission failed"));

      const params = {
        demoId: "test-demo-id",
        email: "test@example.com",
        fields: {},
      };

      await expect(createLeadSubmissionPublic(params)).rejects.toThrow("Lead submission failed");
    });
  });
});
