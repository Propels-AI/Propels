import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import { DashboardPage } from "@/pages/DashboardPage";
import DemoEditorPage from "@/pages/DemoEditorPage";
import DemoPlayer from "@/pages/DemoPlayer";
import { AuthProvider } from "@/lib/providers/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/editor" element={<DemoEditorPage />} />
          <Route path="/demo-player" element={<DemoPlayer />} />
          <Route path="/" element={<SignInPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
