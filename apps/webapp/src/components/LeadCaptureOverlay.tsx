import { useState } from "react";

export type LeadCaptureOverlayProps = {
  bg?: "white" | "black";
  onSubmit?: (payload: { email: string; name?: string; message?: string }) => void;
  onDismiss?: () => void;
  className?: string;
};

export function LeadCaptureOverlay({ bg = "white", onSubmit, onDismiss, className }: LeadCaptureOverlayProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className={`absolute inset-0 ${bg === "black" ? "bg-black" : "bg-white"} ${className || ""}`}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10 min-h-full w-full flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/95 border rounded-xl shadow-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Stay in the loop</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enjoying the demo? Leave your email and we’ll reach out with updates and next steps.
          </p>

          {submitted ? (
            <div className="text-green-700 bg-green-50 border border-green-200 rounded p-3">
              Thanks! We’ll be in touch shortly.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
                onSubmit?.({ email, name, message });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Message (optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you’re looking for…"
                  className="w-full border rounded px-3 py-2 h-24"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 disabled:opacity-60"
                disabled={!email}
              >
                Notify me
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
