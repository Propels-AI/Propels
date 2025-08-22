import { defineFunction } from "@aws-amplify/backend";

export const verifyAuthChallengeResponse = defineFunction({
  name: "verify-auth-challenge-response",
  entry: "./handler.ts",
});
