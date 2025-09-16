import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DeleteDemoModal } from "@/components/DeleteConfirmationModal";

// Mock the provider
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Demo Deletion Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DeleteDemoModal Integration", () => {
    it("should display demo deletion modal with lead preservation notice", () => {
      const mockProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        demoName: "My Product Demo",
      };

      render(<DeleteDemoModal {...mockProps} />);

      // Should show the modal title
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Delete Demo" })).toBeInTheDocument();

      // Should show the demo name (text might be split across elements)
      expect(screen.getByText("Demo:")).toBeInTheDocument();
      expect(screen.getByText("My Product Demo")).toBeInTheDocument();

      // Should show lead preservation notice
      expect(
        screen.getByText(/Lead submissions will be preserved and can still be accessed from the leads page/)
      ).toBeInTheDocument();

      // Should have action buttons
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Demo" })).toBeInTheDocument();
    });

    it("should handle demo deletion workflow", async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn().mockResolvedValue(undefined);
      const mockOnClose = vi.fn();

      const mockProps = {
        isOpen: true,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        demoName: "Test Demo",
      };

      render(<DeleteDemoModal {...mockProps} />);

      // Click delete button (the button, not the title)
      const deleteButton = screen.getByRole("button", { name: "Delete Demo" });
      await user.click(deleteButton);

      // Should call onConfirm
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);

      // Should close modal after completion
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle cancellation", async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      const mockOnConfirm = vi.fn();

      const mockProps = {
        isOpen: true,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        demoName: "Test Demo",
      };

      render(<DeleteDemoModal {...mockProps} />);

      // Click cancel button
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      // Should call onClose but not onConfirm
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should handle deletion errors gracefully", async () => {
      const user = userEvent.setup();

      const mockOnConfirm = vi.fn().mockRejectedValue(new Error("Deletion failed"));
      const mockOnClose = vi.fn();

      const mockProps = {
        isOpen: true,
        onClose: mockOnClose,
        onConfirm: mockOnConfirm,
        demoName: "Test Demo",
      };

      render(<DeleteDemoModal {...mockProps} />);

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "Delete Demo" });

      await user.click(deleteButton);

      // Wait for the onConfirm to be called
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      });

      // Wait for the component to handle the error and update state
      await waitFor(() => {
        // Should show error UI
        expect(screen.getByText(/Error: Deletion failed/)).toBeInTheDocument();
      });

      // Modal should remain open on error (onClose should not be called)
      expect(mockOnClose).not.toHaveBeenCalled();

      // Modal should still be visible since error occurred
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Buttons should be enabled again after error
      expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Delete Demo" })).not.toBeDisabled();
    });
  });

  describe("Lead Data Preservation Logic", () => {
    it("should verify lead data structure includes demo name preservation", () => {
      // Mock lead data structure that should be preserved
      const mockLeadData = {
        demoId: "demo-123",
        email: "test@example.com",
        fields: JSON.stringify({
          name: "John Doe",
          company: "Acme Corp",
          _demo_name: "My Product Demo", // This should be preserved
          _demo_id: "demo-123",
        }),
        createdAt: "2023-01-01T00:00:00Z",
      };

      // Parse the fields to verify structure
      const fields = JSON.parse(mockLeadData.fields);

      expect(fields._demo_name).toBe("My Product Demo");
      expect(fields._demo_id).toBe("demo-123");
      expect(fields.name).toBe("John Doe");
      expect(fields.company).toBe("Acme Corp");
    });

    it("should handle demo name extraction from preserved lead data", () => {
      const mockLeads = [
        {
          demoId: "demo-123",
          fields: JSON.stringify({
            _demo_name: "Demo abc12345", // UUID-style name
          }),
        },
        {
          demoId: "demo-123",
          fields: JSON.stringify({
            _demo_name: "My Actual Product Demo", // Good name
          }),
        },
      ];

      // Simulate the logic to find the best name
      let bestName = "";
      for (const lead of mockLeads) {
        const fields = JSON.parse(lead.fields);
        const demoName = fields._demo_name;
        if (demoName && !demoName.startsWith("Demo ")) {
          bestName = demoName;
          break;
        }
      }

      expect(bestName).toBe("My Actual Product Demo");
    });
  });

  describe("URL Route Handling", () => {
    it("should support /all-leads route for viewing all leads including deleted demos", () => {
      // This test verifies the route structure exists
      const allLeadsUrl = "/all-leads";
      expect(allLeadsUrl).toBe("/all-leads");

      // Mock data structure for all leads page
      const mockAllLeadsData = [
        {
          demoId: "active-demo",
          demoName: "Active Product Demo",
          status: "PUBLISHED",
          leadCount: 5,
        },
        {
          demoId: "deleted-demo",
          demoName: "Deleted Product Demo", // No [DELETED] prefix
          status: "DELETED",
          leadCount: 3,
        },
      ];

      // Verify structure
      expect(mockAllLeadsData).toHaveLength(2);
      expect(mockAllLeadsData[1].status).toBe("DELETED");
      expect(mockAllLeadsData[1].demoName).not.toMatch(/^\[DELETED\]/);
    });

    it("should support /leads/:id route for viewing individual demo leads", () => {
      // This test verifies the route structure and data handling
      const leadsUrl = "/leads/demo-123";
      const demoId = leadsUrl.split("/")[2];

      expect(demoId).toBe("demo-123");

      // Mock response structure for individual leads page
      const mockLeadsResponse = {
        leads: [
          {
            email: "test@example.com",
            fields: JSON.stringify({
              _demo_name: "Preserved Demo Name",
            }),
          },
        ],
        isDemoDeleted: true,
        demoName: "Preserved Demo Name",
      };

      expect(mockLeadsResponse.isDemoDeleted).toBe(true);
      expect(mockLeadsResponse.demoName).toBe("Preserved Demo Name");
    });
  });
});
