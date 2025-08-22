import "@aws-amplify/ui-react/styles.css";
import {
  SignedIn,
  SignedOut,
  RedirectToDashboard,
} from "@/lib/auth/AuthComponents";
import { PasswordlessAuth } from "@/components/auth/PasswordlessAuth";
import { useNavigate } from "react-router-dom";

export default function SignInPage() {
  const navigate = useNavigate();

  const handleAuthSuccess = () => {
    const returnPath = localStorage.getItem("returnToAfterAuth");
    if (returnPath) {
      localStorage.removeItem("returnToAfterAuth");
      navigate(returnPath);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <>
      <SignedIn>
        <RedirectToDashboard />
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4">
          <div className="w-full max-w-md space-y-6">
            <PasswordlessAuth onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      </SignedOut>
    </>
  );
}
