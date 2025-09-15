import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { listMyDemos } from "@/lib/api/demos";
import { getLeadStatsByDemo } from "@/lib/api/leads";
import { useAuth } from "@/lib/providers/AuthProvider";

function AllLeadsPageInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Get existing demos
  const {
    data: demos,
    isLoading: demosLoading,
    error: demosError,
  } = useQuery({
    queryKey: ["demos", user?.userId, "ALL"],
    queryFn: () => listMyDemos(undefined), // Get all demos
    enabled: !!user,
  });

  // Get lead statistics (includes deleted demos)
  const {
    data: leadStats,
    isLoading: leadStatsLoading,
    error: leadStatsError,
  } = useQuery({
    queryKey: ["leadStats", user?.userId],
    queryFn: () => getLeadStatsByDemo(),
    enabled: !!user,
  });

  const isLoading = demosLoading || leadStatsLoading;
  const error = demosError || leadStatsError;

  // Combine existing demos with deleted demos that have leads
  const allDemosWithLeads = useMemo(() => {
    const existingDemos = demos || [];
    const existingDemoIds = new Set(existingDemos.map((d) => d.id));

    // Find deleted demos (have leads but not in demo list)
    const deletedDemosWithLeads = (leadStats || [])
      .filter((stat) => !existingDemoIds.has(stat.demoId))
      .map((stat) => ({
        id: stat.demoId,
        name: stat.demoName,
        status: "DELETED" as const,
        createdAt: stat.earliestLeadDate,
        updatedAt: stat.latestLeadDate,
        isDeleted: true,
        leadCount: stat.leadCount,
      }));

    // Add lead counts to existing demos
    const existingWithLeadCounts = existingDemos.map((demo) => {
      const leadStat = leadStats?.find((stat) => stat.demoId === demo.id);
      return {
        ...demo,
        isDeleted: false,
        leadCount: leadStat?.leadCount || 0,
      };
    });

    return [...existingWithLeadCounts, ...deletedDemosWithLeads];
  }, [demos, leadStats]);

  const filteredDemos = useMemo(() => {
    return allDemosWithLeads.filter(
      (demo) =>
        demo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        demo.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allDemosWithLeads, searchTerm]);

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{(error as any)?.message || String(error)}</div>;

  const downloadAllLeadsCSV = async () => {
    // Note: This would require a new API endpoint to efficiently fetch all leads
    alert("Bulk export coming soon! For now, export leads individually from each demo.");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground mt-1">Access and manage lead submissions from all your demos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadAllLeadsCSV} variant="outline">
            Export All Leads
          </Button>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search demos by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground">Total Demos</h3>
          <p className="text-2xl font-bold text-primary">{demos?.length || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground">Published Demos</h3>
          <p className="text-2xl font-bold text-green-600">
            {demos?.filter((d) => d.status === "PUBLISHED").length || 0}
          </p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground">Draft Demos</h3>
          <p className="text-2xl font-bold text-amber-600">{demos?.filter((d) => d.status === "DRAFT").length || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground">Deleted Demos w/ Leads</h3>
          <p className="text-2xl font-bold text-red-600">{filteredDemos.filter((d) => d.isDeleted).length || 0}</p>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground">Total Lead Submissions</h3>
          <p className="text-2xl font-bold text-blue-600">
            {leadStats?.reduce((sum, stat) => sum + stat.leadCount, 0) || 0}
          </p>
        </div>
      </div>

      {/* Demo List with Lead Access */}
      <div className="bg-card rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Demos & Lead Access</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Click on any demo to view its lead submissions. Deleted demos preserve their leads.
          </p>
        </div>

        <div className="divide-y">
          {filteredDemos.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm ? "No demos match your search" : "No demos found"}
            </div>
          ) : (
            filteredDemos.map((demo) => (
              <div key={demo.id} className="p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-foreground">{demo.name || "Untitled Demo"}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          demo.status === "PUBLISHED"
                            ? "bg-green-100 text-green-700"
                            : demo.status === "DELETED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {demo.status || "DRAFT"}
                      </span>
                      {(demo as any).leadCount > 0 && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {(demo as any).leadCount} leads
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>ID: {demo.id}</span>
                      <span>Created: {demo.createdAt ? new Date(demo.createdAt).toLocaleDateString() : "-"}</span>
                      <span>Updated: {demo.updatedAt ? new Date(demo.updatedAt).toLocaleDateString() : "-"}</span>
                      {demo.isDeleted && <span className="text-red-500 font-medium">⚠️ Demo deleted</span>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/leads/${encodeURIComponent(demo.id)}`)}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      View Leads
                    </Button>
                    {!demo.isDeleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/editor?demoId=${encodeURIComponent(demo.id)}`)}
                      >
                        Edit Demo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Lead Preservation Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <div>
            <h3 className="font-medium text-blue-900">Lead Preservation Policy</h3>
            <p className="text-sm text-blue-700 mt-1">
              When you delete a demo, all lead submissions are automatically preserved. You can still access these
              valuable contacts even after the demo is removed. Lead data is only removed when explicitly deleted by the
              owner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllLeadsPage() {
  return (
    <ProtectedRoute>
      <AllLeadsPageInner />
    </ProtectedRoute>
  );
}
