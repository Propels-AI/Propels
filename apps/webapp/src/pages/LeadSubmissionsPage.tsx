import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { listLeadSubmissions } from "@/lib/api/demos";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

function LeadSubmissionsPageInner() {
  const { demoId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!demoId) return;
      setLoading(true);
      setError(undefined);
      try {
        const data = await listLeadSubmissions(demoId);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load leads");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoId]);

  const columns = useMemo(() => {
    const defs: Array<{
      key: string;
      title: string;
      get: (r: any) => any;
      className: string;
    }> = [
      { key: "createdAt", title: "Created", get: (r) => r.createdAt || "", className: "p-2 whitespace-nowrap" },
      {
        key: "email",
        title: "Email",
        get: (r) => r.email || (r.fields?.email ?? ""),
        className: "p-2 whitespace-nowrap",
      },
      { key: "name", title: "Name", get: (r) => r.fields?.name || "", className: "p-2 whitespace-nowrap" },
      { key: "phone", title: "Phone", get: (r) => r.fields?.phone || "", className: "p-2 whitespace-nowrap" },
      {
        key: "position",
        title: "Position",
        get: (r) => r.fields?.position || "",
        className: "p-2 whitespace-nowrap",
      },
      { key: "message", title: "Message", get: (r) => r.fields?.message || "", className: "p-2" },
      { key: "custom", title: "Custom", get: (r) => r.fields?.custom || "", className: "p-2" },
      { key: "stepIndex", title: "Step", get: (r) => r.stepIndex ?? "", className: "p-2 text-center" },
      { key: "pageUrl", title: "Page", get: (r) => r.pageUrl || "", className: "p-2 truncate max-w-[240px]" },
      { key: "source", title: "Source", get: (r) => r.source || "", className: "p-2 whitespace-nowrap" },
    ];
    const hasValue = (v: any) => {
      if (v == null) return false;
      const s = String(v);
      return s.trim().length > 0;
    };
    // Only keep columns that have at least one non-empty value across rows
    return defs.filter((col) => rows.some((r) => hasValue(col.get(r))));
  }, [rows]);

  const csv = useMemo(() => {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = columns.map((c) => c.key).join(",");
    const lines = rows.map((r) => columns.map((c) => escape(c.get(r))).join(","));
    return [header, ...lines].join("\n");
  }, [rows, columns]);

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${demoId || "demo"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!demoId) return <div className="p-6">Missing demoId</div>;
  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Leads for {demoId}</h1>
        <button onClick={downloadCsv} className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
          Export CSV
        </button>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left p-2">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              return (
                <tr key={r.itemSK} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.get(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={10}>
                  No leads captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeadSubmissionsPage() {
  return (
    <ProtectedRoute>
      <LeadSubmissionsPageInner />
    </ProtectedRoute>
  );
}
