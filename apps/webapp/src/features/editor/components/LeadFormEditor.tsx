import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listLeadTemplates, saveLeadTemplate } from "@/lib/api/demos";

export type LeadFormConfig = any;

export default function LeadFormEditor(props: {
  leadFormConfig: LeadFormConfig;
  setLeadFormConfig: (updater: (prev: LeadFormConfig) => LeadFormConfig) => void | LeadFormConfig;
}) {
  const { leadFormConfig, setLeadFormConfig } = props;

  return (
    <div className="pt-4 border-t border-border mt-6">
      <h3 className="text-lg font-semibold mb-3 text-foreground font-sans">Lead Form</h3>
      <div className="space-y-3 text-sm text-foreground font-sans">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-sans">Title</label>
              <input
                className="w-full bg-background border border-input text-foreground rounded-md px-3 py-2 text-sm font-sans focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                value={leadFormConfig.title || ""}
                onChange={(e) => setLeadFormConfig((p: any) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-sans">CTA Text</label>
              <input
                className="w-full bg-background border border-input text-foreground rounded-md px-3 py-2 text-sm font-sans focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                value={leadFormConfig.ctaText || ""}
                onChange={(e) => setLeadFormConfig((p: any) => ({ ...p, ctaText: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1 font-sans">Subtitle</label>
            <textarea
              className="w-full bg-background border border-input text-foreground rounded-md px-3 py-2 h-16 text-sm font-sans focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none resize-none"
              value={leadFormConfig.subtitle || ""}
              onChange={(e) => setLeadFormConfig((p: any) => ({ ...p, subtitle: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-sans">Fields</div>
            {[
              { key: "email", label: "Email", type: "email", required: true },
              { key: "name", label: "Name", type: "text" },
              { key: "phone", label: "Phone", type: "tel" },
              { key: "position", label: "Position", type: "text" },
              { key: "message", label: "Message", type: "textarea" },
              { key: "custom", label: "Custom", type: "text" },
            ].map((f) => {
              const list: any[] = Array.isArray(leadFormConfig.fields) ? leadFormConfig.fields : [];
              const exists = list.find((x) => x.key === f.key);
              const enabled = !!exists;
              return (
                <label key={f.key} className="flex items-center gap-2 text-sm text-foreground font-sans">
                  <input
                    type="checkbox"
                    className="accent-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    checked={enabled}
                    disabled={f.key === "email"}
                    onChange={(e) => {
                      setLeadFormConfig((p: any) => {
                        const current: any[] = Array.isArray(p.fields) ? [...p.fields] : [];
                        if (e.target.checked) {
                          if (!current.find((x) => x.key === f.key))
                            current.push({ key: f.key, type: f.type, label: f.label });
                        } else {
                          const idx = current.findIndex((x) => x.key === f.key);
                          if (idx >= 0) current.splice(idx, 1);
                        }
                        // Ensure email is present & required
                        if (!current.find((x) => x.key === "email"))
                          current.unshift({ key: "email", type: "email", label: "Email", required: true });
                        return { ...p, fields: current };
                      });
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <TemplatePicker getConfig={() => leadFormConfig} applyConfig={(cfg) => setLeadFormConfig(() => cfg)} />
        </div>
      </div>
    </div>
  );
}

function TemplatePicker(props: { getConfig: () => any; applyConfig: (cfg: any) => void }) {
  const { getConfig, applyConfig } = props;
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Array<{ templateId: string; name: string; leadConfig: any }>>([]);
  const [name, setName] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const list = await listLeadTemplates();
      setTemplates(list);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-8" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Load templates"}
        </Button>
        <select
          onChange={(e) => {
            const t = templates.find((x) => x.templateId === e.target.value);
            if (t?.leadConfig) {
              const cfg = typeof t.leadConfig === "string" ? JSON.parse(t.leadConfig) : t.leadConfig;
              applyConfig(cfg);
            }
          }}
          className="bg-background border border-input text-foreground rounded-md px-3 py-2 text-xs font-sans focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
        >
          <option value="">Select template…</option>
          {templates.map((t) => (
            <option key={t.templateId} value={t.templateId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="h-8 text-xs w-48 font-sans"
        />
        <Button
          variant="outline"
          className="h-8"
          onClick={async () => {
            if (!name.trim()) return;
            try {
              await saveLeadTemplate(name.trim(), getConfig());
              setName("");
              await load();
            } catch {}
          }}
        >
          Save as template
        </Button>
      </div>
    </div>
  );
}
