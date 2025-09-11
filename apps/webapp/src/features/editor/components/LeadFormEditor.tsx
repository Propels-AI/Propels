import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

        <div className="space-y-3">
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const list = await listLeadTemplates();
      setTemplates(list);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  // Auto-load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const templateOptions = templates.map((t) => ({
    value: t.templateId,
    label: t.name,
  }));

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.templateId === templateId);
    if (template?.leadConfig) {
      const cfg = typeof template.leadConfig === "string" ? JSON.parse(template.leadConfig) : template.leadConfig;
      applyConfig(cfg);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;

    try {
      setSaving(true);
      await saveLeadTemplate(templateName.trim(), getConfig());
      setTemplateName("");
      setDialogOpen(false);
      await loadTemplates(); // Refresh the list
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {/* Template Loading Section */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-sans">Or load a template</p>
          <Combobox
            options={templateOptions}
            value=""
            onValueChange={handleTemplateSelect}
            placeholder={loading ? "Loading templates..." : "Select a template..."}
            className="w-full"
          />
        </div>

        {/* Template Saving Section */}
        <div>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="w-full font-sans">
            Save as template
          </Button>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Save this configuration to load in future forms
          </p>
        </div>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans">Save Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground font-sans">Template Name</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter a name for this template"
                className="font-sans"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setTemplateName("");
              }}
              disabled={saving}
              className="font-sans"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || saving} className="font-sans">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
