import type { CreateAuthChallengeTriggerEvent } from "aws-lambda";
import { SES } from "@aws-sdk/client-ses";
import { randomInt } from "crypto";

export const handler = async (event: CreateAuthChallengeTriggerEvent) => {
  console.log("CreateAuthChallenge trigger started", {
    triggerSource: event.triggerSource,
    region: event.region,
    hasUserName: !!event.userName,
  });

  // For passwordless auth, we'll always use CUSTOM_CHALLENGE
  if (event.request.challengeName === "CUSTOM_CHALLENGE") {
    // Generate cryptographically secure 6-digit OTP
    const otp = randomInt(100000, 1000000).toString();

    // Store the OTP code in private challenge parameters
    // This is only accessible in the verifyAuthChallengeResponse trigger
    event.response.privateChallengeParameters = { otp };

    // Set the challenge metadata
    event.response.challengeMetadata = "EMAIL_OTP";

    // Get the email address from userAttributes, or fallback to clientMetadata (from frontend signIn options)
    const email = event.request.userAttributes.email || event.request.clientMetadata?.email;
    console.log("Email resolution", {
      hasEmailInAttributes: !!event.request.userAttributes.email,
      hasEmailInMetadata: !!event.request.clientMetadata?.email,
      emailResolved: !!email,
    });

    // Send the OTP code via email using SES
    if (email) {
      console.log("Sending email to:", email);
      const ses = new SES({ region: "ap-southeast-1" });
      const params = {
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Body: {
            Text: {
              Data: `Your verification code is: ${otp}`,
            },
          },
          Subject: {
            Data: "Propels Demo Authentication Code",
          },
        },
        Source: "no-reply@propels.ai", // Replace with your verified SES email address
      };

      try {
        const result = await ses.sendEmail(params);
        console.log("Email sent successfully", { messageId: result.MessageId });
      } catch (error) {
        console.error("Failed to send email:", error);
        // Store error information in the event response
        event.response.privateChallengeParameters.emailError = "true";
      }
    } else {
      console.log("No email found for user");
      // Store error information in the event response
      event.response.privateChallengeParameters.emailError = "true";
    }
  } else {
    console.log("Challenge name is not CUSTOM_CHALLENGE:", event.request.challengeName);
  }

  console.log("CreateAuthChallenge trigger completed", {
    challengeMetadata: event.response.challengeMetadata,
    hasPrivateParams: !!event.response.privateChallengeParameters,
  });
  return event;
};
