import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import AllLeadsPage from "./AllLeadsPage";

// Mock the API modules used by the page
vi.mock("@/lib/api/demos", () => ({
  listMyDemos: vi.fn(),
}));
vi.mock("@/lib/api/leads", () => ({
  getLeadStatsByDemo: vi.fn(),
}));

vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: vi.fn(() => ({
    user: { userId: "test-user" },
    isLoading: false,
  })),
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
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe("AllLeadsPage - Deleted Demo Support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display existing demos with their leads", async () => {
    const { listMyDemos } = await import("@/lib/api/demos");
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    (listMyDemos as any).mockResolvedValue([
      {
        id: "demo-123",
        name: "Active Product Demo",
        status: "PUBLISHED",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ]);

    (getLeadStatsByDemo as any).mockResolvedValue([
      {
        demoId: "demo-123",
        demoName: "Active Product Demo",
        leadCount: 5,
        earliestLeadDate: "2023-01-01T00:00:00Z",
        latestLeadDate: "2023-01-02T00:00:00Z",
      },
    ]);

    renderWithProviders(<AllLeadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Active Product Demo")).toBeInTheDocument();
      expect(screen.getByText("5 leads")).toBeInTheDocument();
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
    });
  });

  it("should display deleted demos with preserved lead data", async () => {
    const { listMyDemos } = await import("@/lib/api/demos");
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    // No existing demos
    (listMyDemos as any).mockResolvedValue([]);

    // But we have lead stats for a deleted demo
    (getLeadStatsByDemo as any).mockResolvedValue([
      {
        demoId: "deleted-demo-456",
        demoName: "Deleted Product Demo", // This should not have [DELETED] prefix
        leadCount: 3,
        earliestLeadDate: "2022-12-31T00:00:00Z",
        latestLeadDate: "2023-01-01T00:00:00Z",
      },
    ]);

    renderWithProviders(<AllLeadsPage />);

    await waitFor(() => {
      // Should show the preserved demo name without [DELETED] prefix
      expect(screen.getByText("Deleted Product Demo")).toBeInTheDocument();
      expect(screen.getByText("3 leads")).toBeInTheDocument();

      // Should show DELETED status badge
      expect(screen.getByText("DELETED")).toBeInTheDocument();

      // Should NOT have [DELETED] prefix in the name
      expect(screen.queryByText("[DELETED] Deleted Product Demo")).not.toBeInTheDocument();
    });
  });

  it("should handle mixed existing and deleted demos", async () => {
    const { listMyDemos } = await import("@/lib/api/demos");
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    (listMyDemos as any).mockResolvedValue([
      {
        id: "demo-123",
        name: "Active Demo",
        status: "PUBLISHED",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ]);

    (getLeadStatsByDemo as any).mockResolvedValue([
      {
        demoId: "demo-123",
        demoName: "Active Demo",
        leadCount: 2,
        earliestLeadDate: "2023-01-01T00:00:00Z",
        latestLeadDate: "2023-01-02T00:00:00Z",
      },
      {
        demoId: "deleted-demo-456",
        demoName: "Deleted Demo",
        leadCount: 4,
        earliestLeadDate: "2022-12-31T00:00:00Z",
        latestLeadDate: "2023-01-01T00:00:00Z",
      },
    ]);

    renderWithProviders(<AllLeadsPage />);

    await waitFor(() => {
      // Active demo
      expect(screen.getByText("Active Demo")).toBeInTheDocument();
      expect(screen.getByText("2 leads")).toBeInTheDocument();
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();

      // Deleted demo
      expect(screen.getByText("Deleted Demo")).toBeInTheDocument();
      expect(screen.getByText("4 leads")).toBeInTheDocument();
      expect(screen.getByText("DELETED")).toBeInTheDocument();
    });
  });

  it("should handle demos with no leads", async () => {
    const { listMyDemos } = await import("@/lib/api/demos");
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    (listMyDemos as any).mockResolvedValue([
      {
        id: "demo-123",
        name: "Demo Without Leads",
        status: "DRAFT",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ]);

    (getLeadStatsByDemo as any).mockResolvedValue([]); // No lead statistics

    renderWithProviders(<AllLeadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Demo Without Leads")).toBeInTheDocument();
      // No blue lead badge should render when leadCount is 0
      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    const { listMyDemos } = await import("@/lib/api/demos");
    const { getLeadStatsByDemo } = await import("@/lib/api/leads");

    // Keep promises pending to simulate loading
    (listMyDemos as any).mockReturnValue(new Promise(() => {}));
    (getLeadStatsByDemo as any).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AllLeadsPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
