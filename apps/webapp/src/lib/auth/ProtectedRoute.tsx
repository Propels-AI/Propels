import React from "react";
import { Navigate } from "react-router-dom";
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

  if (!isAuthenticated) return <Navigate to="/sign-in" replace />;

  return <>{children}</>;
}
