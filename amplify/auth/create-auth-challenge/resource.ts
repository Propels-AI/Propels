import { defineFunction } from "@aws-amplify/backend";

export const createAuthChallenge = defineFunction({
  name: "create-auth-challenge",
  entry: "./handler.ts",
});
