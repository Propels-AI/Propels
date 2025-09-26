import { useMutation, useQuery } from "@tanstack/react-query";
import { listMyDemos, renameDemo, deleteDemo, setDemoStatus } from "@/lib/api/demos";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/lib/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { DeleteDemoModal } from "@/components/DeleteConfirmationModal";

export function DemoListView(props: { statusFilter?: "ALL" | "DRAFT" | "PUBLISHED" } = {}) {
  const { statusFilter = "ALL" } = props;
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [demoToDelete, setDemoToDelete] = useState<{ id: string; name: string } | null>(null);
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const {
    data: demos,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["demos", user?.userId, statusFilter],
    queryFn: () => listMyDemos(statusFilter === "ALL" ? undefined : statusFilter),
    enabled: isAuthenticated,
  });

  // Mutations
  const renameMut = useMutation({
    mutationFn: async (vars: { id: string; name: string }) => renameDemo(vars.id, vars.name),
    onSuccess: () => refetch(),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteDemo(id),
    onSuccess: () => {
      refetch();
      setDeleteModalOpen(false);
      setDemoToDelete(null);
    },
  });
  const statusMut = useMutation({
    mutationFn: async (vars: { id: string; status: "DRAFT" | "PUBLISHED" }) => setDemoStatus(vars.id, vars.status),
    onSuccess: () => refetch(),
  });

  // Auth loading state
  if (authLoading) {
    return <div className="text-muted-foreground">Checking authentication…</div>;
  }

  // Unauthenticated state prompt
  if (!isAuthenticated) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Your Demos</h2>
        <div className="text-sm text-muted-foreground border border-border rounded p-4 bg-card">
          <div className="font-medium text-foreground">Sign in to view your demos</div>
          <div className="mt-1">You need to be signed in to fetch and manage your demos.</div>
          <Button asChild size="sm" className="mt-3">
            <a href="/sign-in">Go to Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading demos...</div>;
  }

  if (error) {
    const message = (error as any)?.message || String(error);
    return (
      <div className="text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded p-3">
        <div className="font-medium">Error retrieving demos</div>
        <div className="mt-1">{message}</div>
        <Button onClick={() => refetch()} variant="destructive" size="sm" className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4 text-foreground">Your Demos</h2>
      {!demos || demos.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-border rounded p-4 bg-card">
          <div className="font-medium text-foreground">No demos found</div>
          <div className="mt-1">Create one from the extension, then open the editor to save it.</div>
          <Button onClick={() => refetch()} variant="secondary" size="sm" className="mt-3">
            Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {demos.map((demo) => (
            <div
              key={demo.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/editor?demoId=${encodeURIComponent(demo.id)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate(`/editor?demoId=${encodeURIComponent(demo.id)}`);
                }
              }}
              className="bg-card p-4 rounded-lg shadow border border-border hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  {editingId === demo.id ? (
                    <>
                      <input
                        className="border border-input bg-background rounded px-2 py-1 text-sm text-foreground"
                        value={nameDrafts[demo.id] ?? demo.name ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setNameDrafts((prev) => ({ ...prev, [demo.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameMut.mutate({ id: demo.id, name: nameDrafts[demo.id] ?? "" });
                          setEditingId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                          setNameDrafts((prev) => ({ ...prev, [demo.id]: demo.name ?? "" }));
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-medium text-lg text-foreground">{demo.name || "Untitled Demo"}</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(demo.id);
                          setNameDrafts((prev) => ({ ...prev, [demo.id]: demo.name ?? "" }));
                        }}
                      >
                        Rename
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      demo.status === "PUBLISHED" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"
                    }`}
                  >
                    {demo.status || "DRAFT"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = demo.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
                      statusMut.mutate({ id: demo.id, status: next });
                    }}
                  >
                    {demo.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/leads/${encodeURIComponent(demo.id)}`);
                    }}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    Leads
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDemoToDelete({ id: demo.id, name: demo.name || "Untitled Demo" });
                      setDeleteModalOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                <span>Created: {demo.createdAt ? new Date(demo.createdAt).toLocaleDateString() : "-"}</span>
                <span>Updated: {demo.updatedAt ? new Date(demo.updatedAt).toLocaleDateString() : "-"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteDemoModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async () => {
          if (!demoToDelete) return;
          
          try {
            await deleteMut.mutateAsync(demoToDelete.id);
          } catch (error) {
            console.error('Failed to delete demo:', error);
            // Error is handled by the mutation's onError callback
          } finally {
            setDeleteModalOpen(false);
          }
        }}
        demoName={demoToDelete?.name || "Untitled Demo"}
      />
    </div>
  );
}
