import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LeadSubmissionsPage from "./LeadSubmissionsPage";

vi.mock("@/lib/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { username: "tester" }, isLoading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/lib/api/hooks", () => ({
  useLeadSubmissionsSmartly: vi.fn(() => ({
    data: { leads: [], isDemoDeleted: false, demoName: "Test Demo" },
    isLoading: false,
    error: null,
  })),
}));

const useLeadSubmissionsSmartly = async () =>
  (await import("@/lib/api/hooks")).useLeadSubmissionsSmartly as unknown as ReturnType<typeof vi.fn>;

describe("LeadSubmissionsPage", () => {
  const origError = console.error;
  const origWarn = console.warn;
  beforeEach(() => {
    vi.restoreAllMocks();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.error = origError;
    console.warn = origWarn;
  });

  const renderAt = (demoId: string) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/leads/${demoId}`]}>
          <Routes>
            <Route path="/leads/:demoId" element={<LeadSubmissionsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("shows only columns that have any values", async () => {
    (await useLeadSubmissionsSmartly())!.mockReturnValue({
      data: {
        leads: [
          {
            demoId: "demo-1",
            itemSK: "LEAD#1",
            email: "a@example.com",
            stepIndex: 1,
            pageUrl: "https://example.com",
            source: "embed",
            createdAt: "2025-01-01T00:00:00.000Z",
          },
          {
            demoId: "demo-1",
            itemSK: "LEAD#2",
            email: "b@example.com",
            fields: { name: "Bob" },
            stepIndex: 1,
            pageUrl: "https://example.com",
            source: "embed",
            createdAt: "2025-01-02T00:00:00.000Z",
          },
        ],
        isDemoDeleted: false,
        demoName: "Test Demo",
      },
      isLoading: false,
      error: null,
    });

    renderAt("demo-1");

    // Headers that should appear
    await waitFor(() => expect(screen.getByText(/Created/i)).toBeInTheDocument());
    expect(screen.getByText(/Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Step/i)).toBeInTheDocument();
    expect(screen.getByText(/Page/i)).toBeInTheDocument();
    expect(screen.getByText(/Source/i)).toBeInTheDocument();
    // Name should appear because one row has fields.name
    expect(screen.getByText(/Name/i)).toBeInTheDocument();
    // Columns with no values (e.g., Phone) should be absent
    expect(screen.queryByText(/Phone/i)).toBeNull();
  });
});
