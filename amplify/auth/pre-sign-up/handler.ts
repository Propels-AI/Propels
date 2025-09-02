import type { PreSignUpTriggerEvent } from "aws-lambda";

export const handler = async (event: PreSignUpTriggerEvent) => {
  console.log("PreSignUp trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
    userPoolId: event.userPoolId,
    userName: event.userName,
  });

  // Auto-confirm the user and auto-verify their email so that
  // immediate custom-auth sign-in can proceed with CUSTOM_CHALLENGE.
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  // We are not using phone for verification in this flow.
  // event.response.autoVerifyPhone = false; // optional

  console.log("PreSignUp trigger completed", {
    autoConfirmUser: event.response.autoConfirmUser,
    autoVerifyEmail: event.response.autoVerifyEmail,
  });

  return event;
};
