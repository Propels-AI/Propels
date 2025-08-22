import type { CreateAuthChallengeTriggerEvent } from 'aws-lambda';
import { SES } from '@aws-sdk/client-ses';


export const handler = async (event: CreateAuthChallengeTriggerEvent) => {
  console.log('CreateAuthChallenge trigger started');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // For passwordless auth, we'll always use CUSTOM_CHALLENGE
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    // Create a simple OTP code (in production, you'd want a more secure method)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated OTP:', otp);
    
    // Store the OTP code in private challenge parameters
    // This is only accessible in the verifyAuthChallengeResponse trigger
    event.response.privateChallengeParameters = { otp };
    
    // Set the challenge metadata
    event.response.challengeMetadata = 'EMAIL_OTP';
    
    // Get the email address from userAttributes, or fallback to clientMetadata (from frontend signIn options)
    const email = event.request.userAttributes.email || event.request.clientMetadata?.email;
    console.log("event.request.userAttributes")
    console.info(event.request.userAttributes)
    console.log("event.request.clientMetadata")
    console.info(event.request.clientMetadata)
    console.log('Email address resolved:', email);
    console.log('UserName field:', event.userName);
    console.log('All user attributes:', JSON.stringify(event.request.userAttributes, null, 2));
    
    // Send the OTP code via email using SES
    if (email) {
      console.log('Sending email to:', email);
      const ses = new SES({ region: 'ap-southeast-1' });
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
            Data: 'Propels Demo Authentication Code',
          },
        },
        Source: 'no-reply@propels.ai', // Replace with your verified SES email address
      };
      
      try {
        const result = await ses.sendEmail(params);
        console.log('Email sent successfully:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Failed to send email:', error);
        // Store error information in the event response
        event.response.privateChallengeParameters.emailError = 'true';
      }
    } else {
      console.log('No email found for user');
      // Store error information in the event response
      event.response.privateChallengeParameters.emailError = 'true';
    }
  } else {
    console.log('Challenge name is not CUSTOM_CHALLENGE:', event.request.challengeName);
  }
  
  console.log('CreateAuthChallenge trigger completed');
  console.log('Response:', JSON.stringify(event.response, null, 2));
  return event;
};
