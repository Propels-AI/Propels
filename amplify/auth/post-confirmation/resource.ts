import { defineFunction, secret } from "@aws-amplify/backend";

export const postConfirmation = defineFunction({
  name: "post-confirmation",
  entry: "./handler.ts",
  environment: {
    BREVO_API_KEY: secret("BREVO_API_KEY"),
  },
});
