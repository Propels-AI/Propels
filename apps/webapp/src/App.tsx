import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import { DashboardPage } from "@/pages/DashboardPage";
import DemoEditorPage from "@/pages/DemoEditorPage";
import DemoPlayer from "@/pages/DemoPlayer";
import PublicDemoPlayer from "@/pages/PublicDemoPlayer";
import PublicDemoEmbed from "@/pages/PublicDemoEmbed";
import BlogPreviewPage from "./pages/BlogPreviewPage";
import LeadSubmissionsPage from "@/pages/LeadSubmissionsPage";
import AllLeadsPage from "@/pages/AllLeadsPage";
import { AuthProvider } from "@/lib/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/editor" element={<DemoEditorPage />} />
            <Route path="/demo-player" element={<DemoPlayer />} />
            <Route path="/p/:demoId" element={<PublicDemoPlayer />} />
            <Route path="/embed/:demoId" element={<PublicDemoEmbed />} />
            <Route path="/preview-blog" element={<BlogPreviewPage />} />
            <Route path="/leads/:demoId" element={<LeadSubmissionsPage />} />
            <Route path="/all-leads" element={<AllLeadsPage />} />
            <Route path="/" element={<SignInPage />} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
