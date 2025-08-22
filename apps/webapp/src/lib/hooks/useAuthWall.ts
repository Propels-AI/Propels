import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth as useAmplifyAuth } from "@/lib/providers/AuthProvider";
import { signOut } from "aws-amplify/auth";
import { toast } from "sonner";

interface AuthWallOptions {
  redirectMessage?: string;
  redirectDescription?: string;
  returnTo?: string;
  authPath?: string;
  showToast?: boolean;
  autoRedirect?: boolean;
  useEmailOTP?: boolean;
}

export function useAuthWall(options: AuthWallOptions = {}) {
  const { user, isLoading: isAuthLoading } = useAmplifyAuth();
  const navigate = useNavigate();

  const {
    redirectMessage = "Authentication Required",
    redirectDescription = "You need to sign in to access this page.",
    returnTo,
    authPath = "/sign-in",
    showToast = true,
    autoRedirect = true,
    useEmailOTP = false,
  } = options;

  const isSignedIn = !!user;
  const isLoaded = !isAuthLoading;

  const protect = () => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    const redirectPath = returnTo || currentPath;
    if (redirectPath) {
      localStorage.setItem("returnToAfterAuth", redirectPath);
    }
    if (useEmailOTP) {
      localStorage.setItem("preferEmailOTP", "true");
    } else {
      localStorage.removeItem("preferEmailOTP");
    }
    if (showToast) {
      toast.error(redirectMessage, { description: redirectDescription });
    }
    navigate(authPath);
  };

  useEffect(() => {
    if (autoRedirect && !isAuthLoading && !isSignedIn) {
      protect();
    }
  }, [autoRedirect, isAuthLoading, isSignedIn]);

  return {
    isSignedIn,
    isLoaded,
    user,
    protect,
    shouldRender: isSignedIn,
    signOut: async () => {
      try {
        await signOut();
        toast.success("Signed out successfully");
      } catch (error) {
        toast.error("Sign out failed");
      }
    },
  };
}

export function useAuth() {
  const { user, isLoading: isAuthLoading } = useAmplifyAuth();
  return {
    isSignedIn: !!user,
    isLoaded: !isAuthLoading,
    user,
    userId: user?.userId,
  };
}

export function useUser() {
  const { user, isLoading: isAuthLoading } = useAmplifyAuth();
  return {
    user,
    isLoaded: !isAuthLoading,
    isSignedIn: !!user,
  };
}
