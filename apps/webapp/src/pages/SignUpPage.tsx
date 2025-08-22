import { useState, useEffect } from "react";
import "@aws-amplify/ui-react/styles.css";
import {
  SignedIn,
  SignedOut,
  RedirectToDashboard,
} from "@/lib/auth/AuthComponents";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";
import { useNavigate } from "react-router-dom";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [hasAnonymousSession, setHasAnonymousSession] = useState(false);

  useEffect(() => {
    const hasDemo = localStorage.getItem("hasAnonymousDemo");
    if (hasDemo) {
      setHasAnonymousSession(true);
    }
  }, []);

  const handleAuthSuccess = () => {
    const returnPath = localStorage.getItem("returnToAfterAuth");
    if (returnPath) {
      localStorage.removeItem("returnToAfterAuth");
      navigate(returnPath);
    } else {
      navigate("/dashboard");
    }
  };

  const syncAnonymousDemo = async () => {
    console.log("Syncing anonymous demo data...");

    localStorage.removeItem("hasAnonymousDemo");
    setHasAnonymousSession(false);
  };

  return (
    <>
      <SignedIn>
        <RedirectToDashboard />
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4">
          <div className="w-full max-w-md space-y-6">
            <PasswordlessAuth
              onAuthSuccess={handleAuthSuccess}
              hasAnonymousSession={hasAnonymousSession}
              onSyncAnonymousDemo={syncAnonymousDemo}
            />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
