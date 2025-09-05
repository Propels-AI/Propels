import { useState } from "react";

export type LeadCaptureOverlayProps = {
  bg?: "white" | "black";
  config?: any; // flexible config JSON (fields, labels, colors)
  onSubmit?: (payload: Record<string, any>) => void;
  onDismiss?: () => void;
  className?: string;
};

export function LeadCaptureOverlay({ bg = "white", config, onSubmit, onDismiss, className }: LeadCaptureOverlayProps) {
  const fields = Array.isArray((config as any)?.fields) ? (config as any).fields : [];
  const title = (config as any)?.title || "Stay in the loop";
  const subtitle = (config as any)?.subtitle || "Enjoying the demo? Leave your details and we’ll reach out.";
  const ctaText = (config as any)?.ctaText || "Notify me";
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className={`absolute inset-0 ${bg === "black" ? "bg-black" : "bg-white"} ${className || ""}`}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10 min-h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/95 border rounded-xl shadow-xl p-6">
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-sm text-gray-600 mb-4">{subtitle}</p>

          {submitted ? (
            <div className="text-green-700 bg-green-50 border border-green-200 rounded p-3">
              Thanks! We’ll be in touch shortly.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
                onSubmit?.(formValues);
              }}
              className="space-y-3"
            >
              {(fields.length
                ? fields
                : [
                    { key: "email", type: "email", label: "Email", required: true, placeholder: "you@company.com" },
                    { key: "name", type: "text", label: "Name (optional)", required: false, placeholder: "Jane Doe" },
                    {
                      key: "message",
                      type: "textarea",
                      label: "Message (optional)",
                      required: false,
                      placeholder: "Tell us what you’re looking for…",
                    },
                  ]
              ).map((f: any) => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-600 mb-1">{f.label || f.key}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      required={!!f.required}
                      placeholder={f.placeholder}
                      className="w-full border rounded px-3 py-2 h-24"
                      value={formValues[f.key] || ""}
                      onChange={(e) => setFormValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      required={!!f.required}
                      placeholder={f.placeholder}
                      className="w-full border rounded px-3 py-2"
                      value={formValues[f.key] || ""}
                      onChange={(e) => setFormValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 disabled:opacity-60"
                disabled={
                  !!(fields.length ? fields : [{ key: "email", type: "email", required: true }]).find(
                    (f: any) => f.required && !(formValues[f.key] || "").trim()
                  ) === true
                }
              >
                {ctaText}
              </button>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full mt-2 border rounded px-3 py-2 bg-white hover:bg-gray-50 text-sm"
                >
                  Continue without leaving email
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LeadCaptureOverlay;
