import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { listLeadSubmissions } from "@/lib/api/demos";

export default function LeadSubmissionsPage() {
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

  const csv = useMemo(() => {
    const cols = [
      "createdAt",
      "email",
      "name",
      "phone",
      "position",
      "message",
      "custom",
      "stepIndex",
      "pageUrl",
      "source",
    ];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = cols.join(",");
    const lines = rows.map((r) => {
      const fields = r.fields || {};
      return [
        r.createdAt || "",
        r.email || fields.email || "",
        fields.name || "",
        fields.phone || "",
        fields.position || "",
        fields.message || "",
        fields.custom || "",
        r.stepIndex ?? "",
        r.pageUrl || "",
        r.source || "",
      ]
        .map(escape)
        .join(",");
    });
    return [header, ...lines].join("\n");
  }, [rows]);

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
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">Position</th>
              <th className="text-left p-2">Message</th>
              <th className="text-left p-2">Custom</th>
              <th className="text-left p-2">Step</th>
              <th className="text-left p-2">Page</th>
              <th className="text-left p-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = r.fields || {};
              return (
                <tr key={r.itemSK} className="border-t">
                  <td className="p-2 whitespace-nowrap">{r.createdAt || ""}</td>
                  <td className="p-2 whitespace-nowrap">{r.email || f.email || ""}</td>
                  <td className="p-2 whitespace-nowrap">{f.name || ""}</td>
                  <td className="p-2 whitespace-nowrap">{f.phone || ""}</td>
                  <td className="p-2 whitespace-nowrap">{f.position || ""}</td>
                  <td className="p-2">{f.message || ""}</td>
                  <td className="p-2">{f.custom || ""}</td>
                  <td className="p-2 text-center">{r.stepIndex ?? ""}</td>
                  <td className="p-2 truncate max-w-[240px]">{r.pageUrl || ""}</td>
                  <td className="p-2 whitespace-nowrap">{r.source || ""}</td>
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
