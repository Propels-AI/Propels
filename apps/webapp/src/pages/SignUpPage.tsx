import { useState, useEffect } from "react";
import "@aws-amplify/ui-react/styles.css";
import { SignedIn, SignedOut, RedirectToDashboard } from "@/lib/auth/AuthComponents";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";
import { useNavigate } from "react-router-dom";
import { syncAnonymousDemo as runSyncAnonymousDemo } from "@/lib/services/syncAnonymousDemo";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [hasAnonymousSession, setHasAnonymousSession] = useState(false);

  useEffect(() => {
    const hasDemo = localStorage.getItem("hasAnonymousDemo");
    if (hasDemo) {
      setHasAnonymousSession(true);
    }

    // Send message to Chrome Extension to check for pending anonymous session
    const checkForAnonymousSession = async () => {
      try {
        const extId = (import.meta as any).env?.VITE_CHROME_EXTENSION_ID || (window as any)?.__EXT_ID__ || "";
        // Try to send message to extension
        const response = await chrome.runtime.sendMessage(extId, {
          type: "GET_CAPTURE_SESSION",
        });

        if (response?.success && response?.data?.length > 0) {
          setHasAnonymousSession(true);
        }
      } catch (error) {
        console.log("Extension not available or no capture session found");
      }
    };

    // Only run this check if we're in a browser environment
    if (typeof chrome !== "undefined" && chrome.runtime) {
      checkForAnonymousSession();
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

    try {
      await runSyncAnonymousDemo();
    } catch (error) {
      console.error("Error syncing anonymous demo data:", error);
    }

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
