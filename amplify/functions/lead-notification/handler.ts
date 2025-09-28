import type { DynamoDBStreamHandler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { SES } from "@aws-sdk/client-ses";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.AWS_REGION || "ap-southeast-1";
const ses = new SES({ region });
const cognitoClient = new CognitoIdentityProviderClient({ region });

// Helper function to redact PII from logs
const redactEmail = (email: string): string => {
  if (!email || !email.includes('@')) return '[REDACTED]';
  const [localPart, domain] = email.split('@');
  const redactedLocal = localPart.length > 2 
    ? localPart.substring(0, 2) + '***'
    : '***';
  return `${redactedLocal}@${domain}`;
};

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
      console.warn("⚠️ No owner email found, skipping notification for lead:", redactEmail(leadData.email || ''));
      return { success: false, error: "No owner email found" };
    }

    const recipientEmail = ownerEmail;
    const sourceEmail = "notifications@propels.ai";
    const dashboardUrl = `https://app.propels.ai/leads/${leadData.demoId}`;
    const emailBody = `You've received a new contact submission: ${leadData.email}

Open the dashboard to check it out: ${dashboardUrl}

---
This is an automated notification from Propels.`;

    console.log("📧 Preparing to send email", {
      to: redactEmail(recipientEmail),
      from: sourceEmail,
      subject: `You've received a new contact submission: ${redactEmail(leadData.email || '')}`,
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
      to: redactEmail(recipientEmail),
      leadEmail: redactEmail(leadData.email || ''),
    });

    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error("❌ Failed to send lead notification email:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  const processedRecords = [];
  const failedRecords: { itemIdentifier: string; error: string }[] = [];

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

      if (emailResult.success) {
        processedRecords.push({
          eventID: record.eventID,
          demoId: leadData.demoId,
          email: redactEmail(leadData.email || ''),
          emailSent: true,
          messageId: emailResult.messageId,
        });
      } else {
        console.error(`❌ Email send failed for record ${record.eventID} (lead: ${redactEmail(leadData.email || '')}):`, emailResult.error);
        failedRecords.push({
          itemIdentifier: record.eventID!,
          error: emailResult.error || "Email send failed",
        });
      }
    } catch (error) {
      console.error(`❌ Error processing record ${record.eventID}:`, error);
      failedRecords.push({
        itemIdentifier: record.eventID!,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (failedRecords.length > 0) {
    console.error("❌ Failed records that will be retried:", failedRecords);
  }

  console.log(`📊 Processing summary: ${processedRecords.length} successful, ${failedRecords.length} failed`);

  return {
    batchItemFailures: failedRecords.map((failed) => ({ itemIdentifier: failed.itemIdentifier })),
  };
};
