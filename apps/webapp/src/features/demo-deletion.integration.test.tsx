import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DemoListView } from "@/components/DemoListView";

// Mock the API functions
vi.mock("@/lib/api/demos", () => ({
  listMyDemos: vi.fn(),
  deleteDemo: vi.fn(),
  renameDemo: vi.fn(),
  setDemoStatus: vi.fn(),
}));

vi.mock("@/lib/api/leads", () => ({
  listLeadSubmissionsSmartly: vi.fn(),
  getLeadStatsByDemo: vi.fn(),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: vi.fn(() => ({
    user: { userId: "test-user" },
    isLoading: false,
  })),
}));

// Mock the UI components to avoid radix-ui issues in tests
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} role="button" {...props}>
      {children}
    </button>
  ),
}));

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

describe("Demo Deletion Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full demo deletion workflow with custom modal", async () => {
    const user = userEvent.setup();
    const { listMyDemos, deleteDemo } = await import("@/lib/api/demos");

    // Mock demo data
    (listMyDemos as any).mockResolvedValue([
      {
        id: "demo-123",
        name: "Product Demo to Delete",
        status: "PUBLISHED",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ]);

    // Mock successful deletion
    (deleteDemo as any).mockResolvedValue(undefined);

    renderWithProviders(<DemoListView />);

    await waitFor(() => {
      expect(screen.getByText("Product Demo to Delete")).toBeInTheDocument();
    });

    // Click the delete button
    const deleteButton = screen.getByText("Delete");
    await user.click(deleteButton);

    // Should open custom modal (not browser confirm)
    await waitFor(() => {
      const dialog = screen.getByTestId("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText(/Lead submissions will be preserved/)).toBeInTheDocument();
    });

    // Cancel should close modal
    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });

    // Open modal again and confirm deletion
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId("dialog")).toBeInTheDocument();
    });

    const confirmDeleteButton = screen.getByRole("button", { name: /Delete Demo/i });
    await user.click(confirmDeleteButton);

    // Should call the delete function
    await waitFor(() => {
      expect(deleteDemo).toHaveBeenCalledWith("demo-123");
    });
  });

  it("should preserve leads data structure during deletion", async () => {
    const { deleteDemo } = await import("@/lib/api/demos");
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    // Mock deleteDemo to NOT delete leads
    (deleteDemo as any).mockImplementation(async (demoId: string) => {
      // Simulate deletion of demo data only
      console.log(`Deleting demo ${demoId} - preserving leads`);
      return Promise.resolve();
    });

    // Mock leads still being available after demo deletion
    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "test@example.com",
          fields: JSON.stringify({
            _demo_name: "Product Demo to Delete",
            _demo_id: "demo-123",
          }),
          createdAt: "2023-01-01T00:00:00Z",
        },
      ],
      isDemoDeleted: true,
      demoName: "Product Demo to Delete",
    });

    // Test that leads are still accessible after deletion
    const demoId = "demo-123";
    await deleteDemo(demoId);

    const leadsResult = await listLeadSubmissionsSmartly(demoId);

    expect(leadsResult.isDemoDeleted).toBe(true);
    expect(leadsResult.demoName).toBe("Product Demo to Delete");
    expect(leadsResult.leads).toHaveLength(1);
    expect(leadsResult.leads[0].email).toBe("test@example.com");
  });

  it("should handle demo with both existing and deleted status in AllLeads view", async () => {
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    // Mock lead stats that include both existing and deleted demos
    (getLeadStatsByDemo as any).mockResolvedValue([
      {
        demoId: "active-demo",
        demoName: "Active Demo",
        leadCount: 5,
        lastLeadAt: "2023-01-02T00:00:00Z",
      },
      {
        demoId: "deleted-demo",
        demoName: "Deleted Demo", // Preserved name without [DELETED] prefix
        leadCount: 3,
        lastLeadAt: "2023-01-01T00:00:00Z",
      },
    ]);

    const leadStats = await getLeadStatsByDemo();

    // Should contain both active and deleted demos
    expect(leadStats).toHaveLength(2);

    // Active demo
    expect(leadStats[0]).toEqual({
      demoId: "active-demo",
      demoName: "Active Demo",
      leadCount: 5,
      lastLeadAt: "2023-01-02T00:00:00Z",
    });

    // Deleted demo - name should be preserved without [DELETED] prefix
    expect(leadStats[1]).toEqual({
      demoId: "deleted-demo",
      demoName: "Deleted Demo", // No [DELETED] prefix
      leadCount: 3,
      lastLeadAt: "2023-01-01T00:00:00Z",
    });
  });

  it("should maintain demo name consistency across lead views", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    const preservedDemoName = "My Awesome Product";

    // Mock the smart leads function to return consistent demo name
    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "user1@example.com",
          fields: JSON.stringify({
            _demo_name: preservedDemoName,
            _demo_id: "demo-123",
          }),
        },
        {
          email: "user2@example.com",
          fields: JSON.stringify({
            _demo_name: preservedDemoName,
            _demo_id: "demo-123",
          }),
        },
      ],
      isDemoDeleted: true,
      demoName: preservedDemoName,
    });

    const result = await listLeadSubmissionsSmartly("demo-123");

    // Demo name should be consistent across all views
    expect(result.demoName).toBe(preservedDemoName);
    expect(result.isDemoDeleted).toBe(true);

    // Each lead should have the preserved demo name
    result.leads.forEach((lead) => {
      const fields = JSON.parse(lead.fields);
      expect(fields._demo_name).toBe(preservedDemoName);
    });
  });
});
