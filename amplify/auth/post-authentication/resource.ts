import { defineFunction, secret } from "@aws-amplify/backend";

export const postAuthentication = defineFunction({
  name: "post-authentication",
  entry: "./handler.ts",
  environment: {
    BREVO_API_KEY: secret("BREVO_API_KEY"),
    BREVO_LIST_ID: process.env.BREVO_LIST_ID ?? "",
  },
  memoryMB: 512,
  timeoutSeconds: 30,
});
