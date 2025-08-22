import { defineFunction } from "@aws-amplify/backend";

export const defineAuthChallenge = defineFunction({
  name: "define-auth-challenge",
  entry: "./handler.ts",
});
