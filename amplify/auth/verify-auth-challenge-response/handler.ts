import type { VerifyAuthChallengeResponseTriggerEvent } from "aws-lambda";

export const handler = async (event: VerifyAuthChallengeResponseTriggerEvent) => {
  console.log("VerifyAuthChallengeResponse trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
  });

  // Check if there was an error sending the email
  const emailError = event.request?.privateChallengeParameters?.emailError;
  if (emailError === "true") {
    console.log("Email error detected in private challenge parameters");
    // If there was an email error, fail the authentication
    event.response.answerCorrect = false;
    console.log("VerifyAuthChallengeResponse trigger completed with email error");
    return event;
  }

  // Get the expected OTP code from private challenge parameters
  const expectedOtp = event.request?.privateChallengeParameters?.otp;
  const userResponse = event.request?.challengeAnswer;

  console.log("OTP verification attempt", {
    hasExpectedOtp: !!expectedOtp,
    hasUserResponse: !!userResponse,
    responseLength: userResponse?.length || 0,
  });

  // Verify the user's response
  if (expectedOtp && userResponse && expectedOtp === userResponse) {
    console.log("OTP verification successful");
    event.response.answerCorrect = true;
  } else {
    console.log("OTP verification failed");
    event.response.answerCorrect = false;
  }

  console.log("VerifyAuthChallengeResponse trigger completed", {
    answerCorrect: event.response.answerCorrect,
  });
  return event;
};
