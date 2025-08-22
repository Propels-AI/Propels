import { useQuery } from "@tanstack/react-query";

interface Demo {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
  updatedAt: string;
}

const mockDemos = [
  {
    id: "1",
    name: "Product Onboarding Demo",
    status: "DRAFT",
    createdAt: "2025-08-10T10:00:00Z",
    updatedAt: "2025-08-15T14:30:00Z",
  },
  {
    id: "2",
    name: "Feature Walkthrough",
    status: "PUBLISHED",
    createdAt: "2025-08-05T09:15:00Z",
    updatedAt: "2025-08-12T16:45:00Z",
  },
  {
    id: "3",
    name: "New User Tutorial",
    status: "DRAFT",
    createdAt: "2025-08-18T11:20:00Z",
    updatedAt: "2025-08-18T11:20:00Z",
  },
];

export function DemoListView() {
  const {
    data: demos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["demos"],
    queryFn: () => Promise.resolve(mockDemos),
  });

  if (isLoading) {
    return <div>Loading demos...</div>;
  }

  if (error) {
    return <div>Error loading demos</div>;
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Your Demos</h2>
      <div className="space-y-3">
        {demos?.map((demo) => (
          <div
            key={demo.id}
            className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">{demo.name}</h3>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  demo.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {demo.status}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
              <span>Created: {new Date(demo.createdAt).toLocaleDateString()}</span>
              <span>Updated: {new Date(demo.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
