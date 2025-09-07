import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/providers/AuthProvider";

export function useAuthCheck() {
  const { user, isLoading } = useAuth();
  return {
    isAuthenticated: !!user,
    isLoading,
  };
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthCheck();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) return <RedirectWithReturn />;

  return <>{children}</>;
}

function RedirectWithReturn() {
  const location = useLocation();
  useEffect(() => {
    try {
      localStorage.setItem("returnToAfterAuth", `${location.pathname}${location.search}${location.hash}`);
    } catch (e) {
      // Ignore storage errors (e.g., private mode restrictions)
    }
  }, [location]);
  return <Navigate to="/sign-in" replace />;
}
