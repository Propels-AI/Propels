import { useMutation, useQuery } from "@tanstack/react-query";
import { listMyDemos, renameDemo, deleteDemo, setDemoStatus } from "@/lib/api/demos";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/lib/providers/AuthProvider";

export function DemoListView() {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const {
    data: demos,
    isLoading,
    error,
    refetch,
    status,
  } = useQuery({
    queryKey: ["demos"],
    queryFn: () => listMyDemos(),
    enabled: isAuthenticated,
  });

  // Mutations
  const renameMut = useMutation({
    mutationFn: async (vars: { id: string; name: string }) => renameDemo(vars.id, vars.name),
    onSuccess: () => refetch(),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteDemo(id),
    onSuccess: () => refetch(),
  });
  const statusMut = useMutation({
    mutationFn: async (vars: { id: string; status: "DRAFT" | "PUBLISHED" }) => setDemoStatus(vars.id, vars.status),
    onSuccess: () => refetch(),
  });

  // Debug logs for query lifecycle
  console.debug("[DemoListView] query status:", status);
  if (isLoading) console.debug("[DemoListView] loading demos...");
  if (error) console.error("[DemoListView] error loading demos:", error);
  if (!isLoading && !error) console.debug("[DemoListView] demos loaded:", demos);

  // Auth loading state
  if (authLoading) {
    return <div>Checking authentication…</div>;
  }

  // Unauthenticated state prompt
  if (!isAuthenticated) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-semibold mb-4">Your Demos</h2>
        <div className="text-sm text-gray-700 border rounded p-4 bg-white">
          <div className="font-medium">Sign in to view your demos</div>
          <div className="mt-1">You need to be signed in to fetch and manage your demos.</div>
          <a
            href="/sign-in"
            className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div>Loading demos...</div>;
  }

  if (error) {
    const message = (error as any)?.message || String(error);
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
        <div className="font-medium">Error retrieving demos</div>
        <div className="mt-1">{message}</div>
        <button
          onClick={() => refetch()}
          className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Your Demos</h2>
      {!demos || demos.length === 0 ? (
        <div className="text-sm text-gray-700 border rounded p-4 bg-white">
          <div className="font-medium">No demos found</div>
          <div className="mt-1">Create one from the extension, then open the editor to save it.</div>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-white hover:bg-black"
          >
            Refresh
          </button>
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
              className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  {editingId === demo.id ? (
                    <>
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        value={nameDrafts[demo.id] ?? demo.name ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setNameDrafts((prev) => ({ ...prev, [demo.id]: e.target.value }))}
                      />
                      <button
                        className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameMut.mutate({ id: demo.id, name: nameDrafts[demo.id] ?? "" });
                          setEditingId(null);
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                          setNameDrafts((prev) => ({ ...prev, [demo.id]: demo.name ?? "" }));
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-medium text-lg">{demo.name || "Untitled Demo"}</h3>
                      <button
                        className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(demo.id);
                          setNameDrafts((prev) => ({ ...prev, [demo.id]: demo.name ?? "" }));
                        }}
                      >
                        Rename
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      demo.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {demo.status || "DRAFT"}
                  </span>
                  <button
                    className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = demo.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
                      statusMut.mutate({ id: demo.id, status: next });
                    }}
                  >
                    {demo.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    className="text-xs px-2 py-1 border rounded bg-red-600 text-white hover:bg-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this demo? This cannot be undone.")) {
                        deleteMut.mutate(demo.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>Created: {demo.createdAt ? new Date(demo.createdAt).toLocaleDateString() : "-"}</span>
                <span>Updated: {demo.updatedAt ? new Date(demo.updatedAt).toLocaleDateString() : "-"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
