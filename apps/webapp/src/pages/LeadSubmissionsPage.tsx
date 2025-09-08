import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useLeadSubmissions } from "@/lib/api/demos";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

function LeadSubmissionsPageInner() {
  const { demoId } = useParams();
  const { data, isLoading, error } = useLeadSubmissions(demoId || "");

  // Normalize rows: parse fields if it is a JSON string
  const normalizedRows = useMemo(() => {
    return (data ?? []).map((r) => {
      let parsed = r?.fields;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {}
      }
      return { ...r, fields: parsed };
    });
  }, [data]);

  const columns = useMemo(() => {
    // Base columns that we always consider
    const baseDefs: Array<{
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

    // Collect dynamic field keys from rows.fields
    const baseKeys = new Set(baseDefs.map((d) => d.key));
    const dynamicKeys = new Set<string>();
    for (const r of normalizedRows) {
      const f = r?.fields || {};
      Object.keys(f).forEach((k) => {
        if (!baseKeys.has(k)) dynamicKeys.add(k);
      });
    }

    const humanize = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

    const dynamicDefs: Array<{
      key: string;
      title: string;
      get: (r: any) => any;
      className: string;
    }> = Array.from(dynamicKeys).map((key) => ({
      key,
      title: humanize(key),
      get: (r) => r.fields?.[key] ?? "",
      className: "p-2",
    }));

    const defs = [...baseDefs, ...dynamicDefs];

    const hasValue = (v: any) => {
      if (v == null) return false;
      const s = String(v);
      return s.trim().length > 0;
    };
    // Only keep columns that have at least one non-empty value across rows
    return defs.filter((col) => normalizedRows.some((r) => hasValue(col.get(r))));
  }, [normalizedRows]);

  const csv = useMemo(() => {
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = columns.map((c) => c.key).join(",");
    const lines = normalizedRows.map((r) => columns.map((c) => escape(c.get(r))).join(","));
    return [header, ...lines].join("\n");
  }, [normalizedRows, columns]);

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
  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{(error as any)?.message || String(error)}</div>;

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
            {normalizedRows.map((r) => {
              return (
                <tr key={r.itemSK} className="border-t">
                  {columns.map((c) => {
                    const raw = c.get(r);
                    const str = raw == null ? "" : String(raw);
                    const display = str.trim().length > 0 ? raw : "–";
                    return (
                      <td key={c.key} className={c.className}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {(data?.length ?? 0) === 0 && (
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
