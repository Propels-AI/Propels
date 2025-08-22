import type { DefineAuthChallengeTriggerEvent } from "aws-lambda";

export const handler = async (event: DefineAuthChallengeTriggerEvent) => {
  console.log("DefineAuthChallenge trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
    sessionLength: event.request.session.length,
    userNotFound: event.request.userNotFound,
  });

  // If Cognito indicates the user does not exist, fail immediately so the client can sign up first
  if (event.request.userNotFound) {
    console.log("User not found, failing authentication to allow client sign-up");
    event.response.failAuthentication = true;
    event.response.issueTokens = false;
    return event;
  }

  // If this is the first attempt, start with CUSTOM_CHALLENGE
  if (event.request.session.length === 0) {
    console.log("First attempt, setting challenge to CUSTOM_CHALLENGE");
    event.response.challengeName = "CUSTOM_CHALLENGE";
    event.response.failAuthentication = false;
    event.response.issueTokens = false;
  } else {
    console.log("Not first attempt, checking session");
    const lastAttempt = event.request.session[event.request.session.length - 1];
    console.log("Last attempt:", JSON.stringify(lastAttempt, null, 2));

    // Check if there was an email error in the previous attempt
    if (
      lastAttempt.challengeMetadata === "EMAIL_OTP" &&
      lastAttempt.challengeName === "CUSTOM_CHALLENGE" &&
      !lastAttempt.challengeResult
    ) {
      // Check if the failure was due to an email error
      // In this case, we should fail the authentication
      console.log("Email error detected, failing authentication");
      event.response.failAuthentication = true;
      event.response.issueTokens = false;
      return event;
    }

    // Check if the user has successfully completed the challenge
    if (lastAttempt.challengeName === "CUSTOM_CHALLENGE" && lastAttempt.challengeResult === true) {
      console.log("Challenge completed successfully, issuing tokens");
      // User has successfully completed the challenge, issue tokens
      event.response.failAuthentication = false;
      event.response.issueTokens = true;
    } else {
      console.log("Challenge not completed, presenting again");
      // User has not successfully completed the challenge, present it again
      event.response.challengeName = "CUSTOM_CHALLENGE";
      event.response.failAuthentication = false;
      event.response.issueTokens = false;
    }
  }

  console.log("DefineAuthChallenge trigger completed", {
    failAuthentication: event.response.failAuthentication,
    issueTokens: event.response.issueTokens,
    challengeName: event.response.challengeName,
  });
  return event;
};
