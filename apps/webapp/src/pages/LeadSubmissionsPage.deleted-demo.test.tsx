import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LeadSubmissionsPage from "./LeadSubmissionsPage";

// Mock the API modules used by the page
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

const renderWithRouter = (component: React.ReactElement, initialEntries: string[] = ["/leads/demo-123"]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/leads/:demoId" element={component} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("LeadSubmissionsPage - Deleted Demo Support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display leads for existing demo", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "test@example.com",
          fields: JSON.stringify({
            name: "John Doe",
            company: "Acme Corp",
            _demo_name: "Product Demo",
          }),
          createdAt: "2023-01-01T00:00:00Z",
        },
      ],
      isDemoDeleted: false,
      demoName: "Product Demo",
    });

    renderWithRouter(<LeadSubmissionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Leads for Product Demo")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();

      // Should NOT show deleted demo warning
      expect(screen.queryByText(/Demo has been deleted/)).not.toBeInTheDocument();
    });
  });

  it("should display leads for deleted demo with warning", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "test@example.com",
          fields: JSON.stringify({
            name: "John Doe",
            _demo_name: "Deleted Product Demo",
          }),
          createdAt: "2023-01-01T00:00:00Z",
        },
      ],
      isDemoDeleted: true,
      demoName: "Deleted Product Demo",
    });

    renderWithRouter(<LeadSubmissionsPage />, ["/leads/deleted-demo-456"]);

    await waitFor(() => {
      expect(screen.getByText("Leads for Deleted Product Demo")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();

      // Should show deleted demo warning
      expect(screen.getByText(/Demo has been deleted, but lead submissions are preserved/)).toBeInTheDocument();

      // Should show demo ID for clarity
      expect(screen.getByText("Demo ID: deleted-demo-456")).toBeInTheDocument();
    });
  });

  it("should display preserved demo name from lead fields", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "test1@example.com",
          fields: JSON.stringify({
            _demo_name: "My Awesome Product",
            _demo_id: "demo-123",
          }),
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          email: "test2@example.com",
          fields: JSON.stringify({
            _demo_name: "My Awesome Product",
            _demo_id: "demo-123",
          }),
          createdAt: "2023-01-02T00:00:00Z",
        },
      ],
      isDemoDeleted: true,
      demoName: "My Awesome Product", // Extracted from preserved fields
    });

    renderWithRouter(<LeadSubmissionsPage />);

    await waitFor(() => {
      // Should use the preserved demo name, not the demo ID
      expect(screen.getByText("Leads for My Awesome Product")).toBeInTheDocument();
      expect(screen.queryByText(/Leads for Demo demo-123/)).not.toBeInTheDocument();

      expect(screen.getByText("test1@example.com")).toBeInTheDocument();
      expect(screen.getByText("test2@example.com")).toBeInTheDocument();
    });
  });

  it("should handle fallback when demo name cannot be determined", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [
        {
          email: "test@example.com",
          fields: JSON.stringify({
            // No _demo_name field
            name: "John Doe",
          }),
          createdAt: "2023-01-01T00:00:00Z",
        },
      ],
      isDemoDeleted: true,
      demoName: undefined, // No name could be determined
    });

    renderWithRouter(<LeadSubmissionsPage />, ["/leads/unknown-demo"]);

    await waitFor(() => {
      // Should fall back to using the demo ID from the URL
      expect(screen.getByText("Leads for unknown-demo")).toBeInTheDocument();
      // The page only shows Demo ID when demoName exists; in this fallback case, it won't show the ID line.
    });
  });

  it("should show empty state when deleted demo has no leads", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockResolvedValue({
      leads: [],
      isDemoDeleted: true,
      demoName: "Demo With No Leads",
    });

    renderWithRouter(<LeadSubmissionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Leads for Demo With No Leads")).toBeInTheDocument();
      expect(screen.getByText(/Demo has been deleted/)).toBeInTheDocument();
      expect(screen.getByText(/No leads captured yet\./)).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockReturnValue(new Promise(() => {}));

    renderWithRouter(<LeadSubmissionsPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("should handle error state gracefully", async () => {
    const { listLeadSubmissionsSmartly } = await import("@/lib/api/leads");

    (listLeadSubmissionsSmartly as any).mockRejectedValue(new Error("Failed to load leads"));

    renderWithRouter(<LeadSubmissionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load leads")).toBeInTheDocument();
    });
  });
});
