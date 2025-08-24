import { ProtectPage } from "@/lib/auth/AuthComponents";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { DemoListView } from "@/components/DemoListView";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

          <DemoListView />
        </div>
      </div>
    </ProtectPage>
  );
}

export default DashboardPage;
