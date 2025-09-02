import { ProtectPage } from "@/lib/auth/AuthComponents";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { DemoListView } from "@/components/DemoListView";
import { useState } from "react";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <ProtectPage>
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <button
              onClick={handleSignOut}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Sign Out
            </button>
          </div>

          <div className="mb-8">
            <p className="text-lg mb-2">Welcome, {user?.username}!</p>
            <p className="text-gray-600">You've successfully signed in with passwordless authentication.</p>
          </div>

          <div className="mb-4">
            <div className="inline-flex rounded-lg border bg-white p-1">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  tab === "PUBLISHED" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setTab("PUBLISHED")}
              >
                Published
              </button>
              <button
                className={`ml-1 px-4 py-2 text-sm font-medium rounded-md ${
                  tab === "DRAFT" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setTab("DRAFT")}
              >
                Drafted
              </button>
            </div>
          </div>

          <DemoListView statusFilter={tab} />
        </div>
      </div>
    </ProtectPage>
  );
}

export default DashboardPage;
