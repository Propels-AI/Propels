import { defineAuth } from "@aws-amplify/backend";
import { createAuthChallenge } from "./create-auth-challenge/resource";
import { defineAuthChallenge } from "./define-auth-challenge/resource";
import { verifyAuthChallengeResponse } from "./verify-auth-challenge-response/resource";
import { preSignUp } from "./pre-sign-up/resource";
import { postAuthentication } from "./post-authentication/resource";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    email: {
      mutable: true,
      required: true,
    },
    "custom:brevoSynced": {
      dataType: "String",
      mutable: true,
    },
  },
  triggers: {
    preSignUp,
    createAuthChallenge,
    defineAuthChallenge,
    verifyAuthChallengeResponse,
    postAuthentication,
  },
});
