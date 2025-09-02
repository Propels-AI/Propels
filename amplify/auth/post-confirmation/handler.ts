import type { PostConfirmationTriggerEvent } from "aws-lambda";
import { env } from "$amplify/env/post-confirmation";

export const handler = async (event: PostConfirmationTriggerEvent) => {
  console.log("PostConfirmation trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
    userName: event.userName,
    hasEmail: !!event.request.userAttributes.email,
  });

  // Only process SIGN_UP events
  if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
    const email = event.request.userAttributes.email;

    if (email) {
      try {
        // Create contact in Brevo via REST API with retries and timeout
        const makeRequest = async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const res = await fetch("https://api.brevo.com/v3/contacts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": env.BREVO_API_KEY,
                "User-Agent": "propels-post-confirmation/1.0",
              },
              body: JSON.stringify({
                email,
                attributes: {
                  FIRSTNAME: event.request.userAttributes.name || "",
                },
                updateEnabled: true,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            return res;
          } catch (err) {
            clearTimeout(timeout);
            throw err;
          }
        };

        let res: Response | null = null;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            res = await makeRequest();
            // Treat 2xx and 409 (already exists) as success
            if (res.ok || res.status === 409) break;
            const body = await res.json().catch(() => ({} as unknown));
            console.warn("Brevo createContact non-OK", {
              attempt,
              email,
              status: res.status,
              body,
            });
          } catch (err) {
            lastErr = err;
            console.warn("Brevo createContact fetch error", { attempt, email, err });
          }
          // Backoff: 200ms, 500ms
          if (attempt < 3) await new Promise((r) => setTimeout(r, attempt === 1 ? 200 : 500));
        }

        if (res && (res.ok || res.status === 409)) {
          const body = await res.json().catch(() => ({} as unknown));
          console.log("Brevo contact upserted", { email, status: res.status, body });
        } else {
          console.error("Brevo createContact failed after retries", { email, lastErr });
        }
      } catch (error) {
        console.error("Failed to create contact in Brevo", { email, error });
        // We don't fail the signup process even if Brevo integration fails
        // This ensures users can still access the app even if CRM integration has issues
      }
    } else {
      console.log("No email found for user, skipping Brevo integration");
    }
  }

  console.log("PostConfirmation trigger completed");
  return event;
};
