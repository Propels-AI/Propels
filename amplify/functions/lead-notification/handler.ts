import type { DynamoDBStreamHandler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SES } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const ses = new SES({ region: "ap-southeast-1" });
const cognitoClient = new CognitoIdentityProviderClient({ region: "ap-southeast-1" });

async function getOwnerEmail(ownerId: string): Promise<string | null> {
  try {
    const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

    if (!userPoolId) {
      console.error("❌ AMPLIFY_AUTH_USERPOOL_ID environment variable not set");
      return null;
    }

    const command = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: ownerId,
    });

    const result = await cognitoClient.send(command);
    const emailAttribute = result.UserAttributes?.find((attr) => attr.Name === "email");
    const email = emailAttribute?.Value;

    if (email) {
      return email;
    }
    return null;
  } catch (error) {
    console.error("❌ Error fetching owner email from Cognito:", error);
    return null;
  }
}

async function sendLeadNotificationEmail(leadData: any) {
  try {
    const fields = typeof leadData.fields === "string" ? JSON.parse(leadData.fields) : leadData.fields || {};
    const demoName = fields._demo_name || `Demo ${leadData.demoId}`;

    const ownerEmail = await getOwnerEmail(leadData.ownerId);

    if (!ownerEmail) {
      console.warn("⚠️ No owner email found, skipping notification for lead:", leadData.email);
      return { success: false, error: "No owner email found" };
    }

    const recipientEmail = ownerEmail;
    const sourceEmail = process.env.NOTIFICATION_EMAIL || "notifications@propels.ai";
    const dashboardUrl = `https://app.propels.ai/leads/${leadData.demoId}`;
    const emailBody = `You've received a new contact submission: ${leadData.email}

Open the dashboard to check it out: ${dashboardUrl}

---
This is an automated notification from Propels.`;

    console.log("📧 Preparing to send email", {
      to: recipientEmail,
      from: sourceEmail,
      subject: `You've received a new contact submission: ${leadData.email}`,
      dashboardUrl,
    });

    const params = {
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Body: {
          Text: {
            Data: emailBody,
          },
        },
        Subject: {
          Data: `You've received a new contact submission: ${leadData.email}`,
        },
      },
      Source: sourceEmail,
    };

    const result = await ses.sendEmail(params);
    console.log("📧 Lead notification email sent successfully", {
      messageId: result.MessageId,
    });

    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error("❌ Failed to send lead notification email:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  const processedRecords = [];
  const errors = [];
  for (const record of event.Records) {
    try {
      if (record.eventName !== "INSERT") {
        continue;
      }

      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        continue;
      }

      const leadData = unmarshall(newImage as any);

      const emailResult = await sendLeadNotificationEmail(leadData);

      processedRecords.push({
        eventID: record.eventID,
        demoId: leadData.demoId,
        email: leadData.email,
        emailSent: emailResult.success,
        messageId: emailResult.messageId,
      });
    } catch (error) {
      console.error(`❌ Error processing record ${record.eventID}:`, error);
      errors.push({
        eventID: record.eventID,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (errors.length > 0) {
    console.error("❌ Processing errors:", errors);
  }

  return {
    batchItemFailures: [],
  };
};
