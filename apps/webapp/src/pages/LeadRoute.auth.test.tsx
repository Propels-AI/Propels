import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import LeadSubmissionsPage from "./LeadSubmissionsPage";

// Mock useAuth state by mocking the provider's hook (no importActual)
vi.mock("@/lib/providers/AuthProvider", () => {
  const useAuth = vi.fn();
  const AuthProvider = ({ children }: any) => children;
  return { useAuth, AuthProvider } as any;
});

describe("/leads/:demoId route auth", () => {
  it("redirects unauthenticated users to /sign-in", async () => {
    const { useAuth }: any = await import("@/lib/providers/AuthProvider");
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });

    render(
      <MemoryRouter initialEntries={["/leads/demo-1"]}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign In Page</div>} />
          <Route
            path="/leads/:demoId"
            element={
              <ProtectedRoute>
                <LeadSubmissionsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Should navigate to sign-in
    expect(await screen.findByText(/Sign In Page/i)).toBeInTheDocument();
  });
});
