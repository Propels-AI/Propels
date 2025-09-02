import type { PostAuthenticationTriggerEvent } from "aws-lambda";
import { env } from "$amplify/env/post-authentication";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

export const handler = async (event: PostAuthenticationTriggerEvent) => {
  console.log("PostAuthentication trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
    userName: event.userName,
    hasEmail: !!event.request.userAttributes.email,
  });

  if (event.triggerSource === "PostAuthentication_Authentication") {
    const email = event.request.userAttributes.email;

    const alreadySynced = event.request.userAttributes["custom:brevoSynced"] === "true";
    if (alreadySynced) {
      console.log("brevoSynced already true, skipping Brevo upsert");
      console.log("PostAuthentication trigger completed (fast-path)");
      return event;
    }

    if (email) {
      const parsedListId = Number(env.BREVO_LIST_ID);
      const listId = Number.isFinite(parsedListId) && parsedListId > 0 ? parsedListId : undefined;
      if (!listId) {
        console.warn("BREVO_LIST_ID not set or invalid; proceeding without assigning listIds");
      }
      try {
        const makeRequest = async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const res = await fetch("https://api.brevo.com/v3/contacts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": env.BREVO_API_KEY,
                "User-Agent": "propels-post-authentication/1.0",
              },
              body: JSON.stringify({
                email,
                attributes: {
                  FIRSTNAME: event.request.userAttributes.name || "",
                },
                listIds: listId ? ([listId] as number[]) : undefined,
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
            const body = await res.json().catch(() => ({}) as unknown);
            console.warn("Brevo createContact (post-auth) non-OK", {
              attempt,
              email,
              status: res.status,
              body,
            });
          } catch (err) {
            lastErr = err;
            console.warn("Brevo createContact (post-auth) fetch error", { attempt, email, err });
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, attempt === 1 ? 200 : 500));
        }

        if (res && (res.ok || res.status === 409)) {
          const body = await res.json().catch(() => ({}) as unknown);
          console.log("Brevo contact upserted (post-auth)", { email, status: res.status, body });

          const cognito = new CognitoIdentityProviderClient({ region: event.region });
          await cognito.send(
            new AdminUpdateUserAttributesCommand({
              UserPoolId: event.userPoolId,
              Username: event.userName,
              UserAttributes: [{ Name: "custom:brevoSynced", Value: "true" }],
            })
          );
          console.log("Set custom:brevoSynced=true for user", { userName: event.userName });
        } else {
          console.error("Brevo createContact (post-auth) failed after retries", { email, lastErr });
        }
      } catch (error) {
        console.error("Failed to upsert contact in Brevo post-auth", { email, error });
        // Do not block authentication on CRM issues
      }
    } else {
      console.log("No email found for user post-auth, skipping Brevo integration");
    }
  }

  console.log("PostAuthentication trigger completed");
  return event;
};
