import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, Mail, MessageSquare, User, CheckCircle } from "lucide-react";

export type LeadCaptureOverlayProps = {
  bg?: "white" | "black";
  config?: any; // flexible config JSON (fields, labels, colors)
  onSubmit?: (payload: Record<string, any>) => void;
  onDismiss?: () => void;
  className?: string;
};

export function LeadCaptureOverlay({ bg = "white", config, onSubmit, onDismiss, className }: LeadCaptureOverlayProps) {
  const id = useId();
  const fields = Array.isArray((config as any)?.fields) ? (config as any).fields : [];
  const title = (config as any)?.title || "Stay in the loop";
  const subtitle = (config as any)?.subtitle || "Enjoying the demo? Leave your details and we'll reach out.";
  const ctaText = (config as any)?.ctaText || "Notify me";
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  // Get icon for field type
  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email":
        return Mail;
      case "textarea":
        return MessageSquare;
      default:
        return User;
    }
  };

  // Default fields if none configured
  const defaultFields = [
    { key: "email", type: "email", label: "Email", required: true, placeholder: "name@example.com" },
    { key: "name", type: "text", label: "Name (optional)", required: false, placeholder: "Jane Doe" },
    {
      key: "message",
      type: "textarea",
      label: "Message (optional)",
      required: false,
      placeholder: "Tell us what you're looking for…",
    },
  ];

  const fieldsToRender = fields.length ? fields : defaultFields;

  return (
    <div className={`absolute inset-0 ${bg === "black" ? "bg-black" : "bg-white"} ${className || ""}`}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10 min-h-full w-full flex items-center justify-center p-6">
        <Card className="w-full max-w-sm mx-auto">
          {submitted ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-semibold tracking-tight">Thank you!</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground px-2">
                      We've received your information and we'll be in touch shortly.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {onDismiss && (
                  <Button variant="outline" className="w-full" onClick={onDismiss}>
                    Continue
                  </Button>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FormInput className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground px-2">{subtitle}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubmitted(true);
                    onSubmit?.(formValues);
                  }}
                  className="space-y-4"
                >
                  {fieldsToRender.map((f: any) => {
                    const Icon = getFieldIcon(f.type);
                    return (
                      <div key={f.key} className="space-y-2">
                        <Label htmlFor={`${id}-${f.key}`} className="text-sm font-medium">
                          {f.label || f.key}
                        </Label>
                        {f.type === "textarea" ? (
                          <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <textarea
                              id={`${id}-${f.key}`}
                              required={!!f.required}
                              placeholder={f.placeholder}
                              className="w-full min-h-[80px] pl-10 pt-3 pb-3 pr-3 text-sm border border-input bg-background rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none resize-none"
                              value={formValues[f.key] || ""}
                              onChange={(e) => setFormValues((p) => ({ ...p, [f.key]: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div className="relative">
                            <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id={`${id}-${f.key}`}
                              type={f.type || "text"}
                              required={!!f.required}
                              placeholder={f.placeholder}
                              className="pl-10"
                              value={formValues[f.key] || ""}
                              onChange={(e) => setFormValues((p) => ({ ...p, [f.key]: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!!fieldsToRender.find((f: any) => f.required && !(formValues[f.key] || "").trim())}
                  >
                    {ctaText}
                  </Button>

                  {onDismiss && (
                    <Button variant="ghost" type="button" className="w-full text-sm" onClick={onDismiss}>
                      Continue without leaving email
                    </Button>
                  )}
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default LeadCaptureOverlay;
