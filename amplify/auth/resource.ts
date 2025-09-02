import { defineAuth } from "@aws-amplify/backend";
import { createAuthChallenge } from "./create-auth-challenge/resource";
import { defineAuthChallenge } from "./define-auth-challenge/resource";
import { verifyAuthChallengeResponse } from "./verify-auth-challenge-response/resource";
import { postConfirmation } from "./post-confirmation/resource";

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
  },
  triggers: {
    createAuthChallenge,
    defineAuthChallenge,
    verifyAuthChallengeResponse,
    postConfirmation,
  },
});
