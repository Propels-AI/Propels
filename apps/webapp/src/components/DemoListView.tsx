import { useQuery } from "@tanstack/react-query";
import { listMyDemos } from "@/lib/api/demos";
import { useNavigate } from "react-router-dom";

export function DemoListView() {
  const navigate = useNavigate();
  const {
    data: demos,
    isLoading,
    error,
    refetch,
    status,
  } = useQuery({
    queryKey: ["demos"],
    queryFn: () => listMyDemos(),
  });

  // Debug logs for query lifecycle
  console.debug("[DemoListView] query status:", status);
  if (isLoading) console.debug("[DemoListView] loading demos...");
  if (error) console.error("[DemoListView] error loading demos:", error);
  if (!isLoading && !error) console.debug("[DemoListView] demos loaded:", demos);

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
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-lg">{demo.name || "Untitled Demo"}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    demo.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {demo.status || "DRAFT"}
                </span>
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
