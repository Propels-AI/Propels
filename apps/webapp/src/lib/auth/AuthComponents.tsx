import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/providers/AuthProvider";
import { Loader2 } from "lucide-react";

interface AuthComponentProps {
  children: React.ReactNode;
}

interface RedirectToSignInProps {
  redirectMessage?: string;
  redirectDescription?: string;
  returnTo?: string;
  authPath?: string;
  showToast?: boolean;
}

export function SignedIn({ children }: AuthComponentProps) {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: AuthComponentProps) {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  return !user ? <>{children}</> : null;
}

export function RedirectToSignIn(props: RedirectToSignInProps) {
  const {
    redirectMessage = "Authentication Required",
    redirectDescription = "You need to sign in to access this page.",
    returnTo,
    authPath = "/sign-in",
    showToast = true,
  } = props;

  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !user) {
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "";
      const redirectPath = returnTo || currentPath;
      if (redirectPath) {
        localStorage.setItem("returnToAfterAuth", redirectPath);
      }

      if (showToast) {
        console.log(redirectMessage, redirectDescription);
      }

      navigate(authPath);
    }
  }, [
    user,
    isLoading,
    navigate,
    returnTo,
    authPath,
    redirectMessage,
    redirectDescription,
    showToast,
  ]);

  return null;
}

export function RedirectToDashboard({
  to = "/dashboard",
  replace = true,
}: {
  to?: string;
  replace?: boolean;
}) {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [hasHandledRedirect, setHasHandledRedirect] = React.useState(false);

  React.useEffect(() => {
    if (isLoading || !user || hasHandledRedirect) return;
    setHasHandledRedirect(true);
    if (replace) navigate(to, { replace: true });
    else navigate(to);
  }, [isLoading, user, hasHandledRedirect, navigate, to, replace]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Redirecting...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin" /> Redirecting...
    </div>
  );
}

export function ProtectPage({ children }: AuthComponentProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return user ? <>{children}</> : <RedirectToSignIn />;
}

export function AuthGuard({
  children,
  fallback,
  loading,
  redirectOnUnauthenticated,
  redirectOptions,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  redirectOnUnauthenticated?: boolean;
  redirectOptions?: RedirectToSignInProps;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading)
    return (
      <>
        {loading || (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </>
    );
  if (!user) {
    if (redirectOnUnauthenticated)
      return <RedirectToSignIn {...redirectOptions} />;
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}
