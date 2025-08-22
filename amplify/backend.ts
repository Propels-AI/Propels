import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { createAuthChallenge } from "./auth/create-auth-challenge/resource";
import { Effect, PolicyStatement, Policy } from "aws-cdk-lib/aws-iam";

const backend = defineBackend({
  auth,
  data,
  storage,
  createAuthChallenge,
});

const sesPolicy = new Policy(backend.createAuthChallenge.stack, "SESPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    }),
  ],
});

backend.createAuthChallenge.resources.lambda.role?.attachInlinePolicy(sesPolicy);
