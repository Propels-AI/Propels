import React from "react";
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

  if (!isAuthenticated) {
    window.location.href = "/sign-in";
    return null;
  }

  return <>{children}</>;
}
