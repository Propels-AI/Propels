import { describe, it, expect, vi, beforeEach } from "vitest";
import { listLeadSubmissionsSmartly, getLeadsForDeletedDemo, listAllMyLeads, getLeadStatsByDemo } from "./leads";

// Mock the dependencies
const mockLeadIntakeList = vi.fn();

vi.mock("aws-amplify/data", () => ({
  generateClient: vi.fn(() => ({
    models: {
      LeadIntake: {
        list: mockLeadIntakeList,
      },
    },
  })),
}));

vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ username: "test-user" })),
}));

vi.mock("./demos", () => ({
  listLeadSubmissions: vi.fn(),
  getOwnerId: vi.fn(() => Promise.resolve("test-owner")),
}));

describe("Lead Preservation After Demo Deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listLeadSubmissionsSmartly", () => {
    it("should return leads with demo info when demo exists", async () => {
      const { listLeadSubmissions } = await import("./demos");

      const mockLeads = [
        {
          demoId: "demo-123",
          email: "test@example.com",
          fields: JSON.stringify({
            _demo_name: "My Product Demo",
            _demo_id: "demo-123",
            name: "John Doe",
          }),
        },
      ];

      (listLeadSubmissions as any).mockResolvedValue(mockLeads);

      const result = await listLeadSubmissionsSmartly("demo-123");

      expect(result).toEqual({
        leads: mockLeads,
        isDemoDeleted: false,
        demoName: "My Product Demo",
      });
    });

    it("should fallback to deleted demo leads when demo is deleted", async () => {
      const { listLeadSubmissions } = await import("./demos");

      // Mock the main function to throw a Forbidden error (demo deleted)
      (listLeadSubmissions as any).mockRejectedValue(new Error("Forbidden: not the owner"));

      // Mock the generateClient to return leads for deleted demo
      const mockLeads = [
        {
          demoId: "deleted-demo-123",
          email: "test@example.com",
          fields: JSON.stringify({
            _demo_name: "Deleted Product Demo",
            _demo_id: "deleted-demo-123",
          }),
        },
      ];

      mockLeadIntakeList.mockResolvedValue({ data: mockLeads });

      const result = await listLeadSubmissionsSmartly("deleted-demo-123");

      expect(result).toEqual({
        leads: mockLeads,
        isDemoDeleted: true,
        demoName: "Deleted Product Demo",
      });
    });

    it("should handle the case when both demo and fallback fail", async () => {
      const { listLeadSubmissions } = await import("./demos");

      (listLeadSubmissions as any).mockRejectedValue(new Error("Forbidden"));

      mockLeadIntakeList.mockRejectedValue(new Error("Network error"));

      await expect(listLeadSubmissionsSmartly("demo-123")).rejects.toThrow("Forbidden");
    });
  });

  describe("getLeadsForDeletedDemo", () => {
    it("should retrieve leads for deleted demo using owner filtering", async () => {
      mockLeadIntakeList.mockResolvedValue({
        data: [
          {
            demoId: "deleted-demo-123",
            email: "test@example.com",
            fields: JSON.stringify({
              _demo_name: "Deleted Product Demo",
              _demo_id: "deleted-demo-123",
            }),
            createdAt: "2023-01-01T00:00:00Z",
          },
        ],
      });

      const result = await getLeadsForDeletedDemo("deleted-demo-123");

      expect(result).toHaveLength(1);
      expect(result[0].demoId).toBe("deleted-demo-123");
      expect(result[0].email).toBe("test@example.com");
    });
  });

  describe("getLeadStatsByDemo", () => {
    it("should include demo names from preserved lead data", async () => {
      mockLeadIntakeList.mockResolvedValue({
        data: [
          {
            demoId: "demo-123",
            email: "test1@example.com",
            fields: JSON.stringify({ _demo_name: "Product Demo A" }),
            createdAt: "2023-01-01T00:00:00Z",
          },
          {
            demoId: "demo-123",
            email: "test2@example.com",
            fields: JSON.stringify({ _demo_name: "Product Demo A" }),
            createdAt: "2023-01-02T00:00:00Z",
          },
          {
            demoId: "demo-456",
            email: "test3@example.com",
            fields: JSON.stringify({ _demo_name: "Product Demo B" }),
            createdAt: "2023-01-03T00:00:00Z",
          },
        ],
      });

      const result = await getLeadStatsByDemo();

      // Sort by demoId for consistent ordering in test
      result.sort((a, b) => a.demoId.localeCompare(b.demoId));

      expect(result).toEqual([
        {
          demoId: "demo-123",
          demoName: "Product Demo A",
          leadCount: 2,
          earliestLeadDate: "2023-01-01T00:00:00Z",
          latestLeadDate: "2023-01-02T00:00:00Z",
        },
        {
          demoId: "demo-456",
          demoName: "Product Demo B",
          leadCount: 1,
          earliestLeadDate: "2023-01-03T00:00:00Z",
          latestLeadDate: "2023-01-03T00:00:00Z",
        },
      ]);
    });
  });
});
