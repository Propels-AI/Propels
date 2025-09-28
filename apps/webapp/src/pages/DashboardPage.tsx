import { ProtectPage } from "@/lib/auth/AuthComponents";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { DemoListView } from "@/components/DemoListView";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

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

  const handleTestMixpanelEvent = () => {
    trackEvent("Test Event", {
      event_type: "button_click",
      button_name: "Test Mixpanel",
      timestamp: new Date().toISOString(),
      user_id: user?.username,
      test_data: {
        random_number: Math.floor(Math.random() * 1000),
        message: "Mixpanel integration test successful!"
      }
    });
  };

  return (
    <ProtectPage>
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-foreground font-sans">
        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/all-leads")} variant="outline">
                All Leads
              </Button>
              <Button onClick={handleTestMixpanelEvent} variant="secondary">
                Test Mixpanel Event
              </Button>
              <Button onClick={handleSignOut} variant="default">
                Sign Out
              </Button>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-lg mb-2 text-foreground">Welcome, {user?.username}!</p>
            <p className="text-muted-foreground">You've successfully signed in with passwordless authentication.</p>
          </div>

          <div className="mb-4">
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <Button variant={tab === "PUBLISHED" ? "default" : "ghost"} size="sm" onClick={() => setTab("PUBLISHED")}>
                Published
              </Button>
              <Button
                variant={tab === "DRAFT" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("DRAFT")}
                className="ml-1"
              >
                Drafted
              </Button>
            </div>
          </div>

          <DemoListView statusFilter={tab} />
        </div>
      </div>
    </ProtectPage>
  );
}

export default DashboardPage;
