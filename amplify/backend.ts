import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { createAuthChallenge } from "./auth/create-auth-challenge/resource";
import { postAuthentication } from "./auth/post-authentication/resource";
import { leadNotificationHandler } from "./functions/lead-notification/resource";
import { Effect, PolicyStatement, Policy } from "aws-cdk-lib/aws-iam";
import { EventSourceMapping, StartingPosition } from "aws-cdk-lib/aws-lambda";

const backend = defineBackend({
  auth,
  data,
  storage,
  createAuthChallenge,
  postAuthentication,
  leadNotificationHandler,
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

const cognitoPolicy = new Policy(backend.postAuthentication.stack, "PostAuthCognitoPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["cognito-idp:AdminUpdateUserAttributes"],
      resources: ["*"],
    }),
  ],
});

backend.postAuthentication.resources.lambda.role?.attachInlinePolicy(cognitoPolicy);

// Configure DynamoDB Stream for LeadIntake table
const leadIntakeTable = backend.data.resources.tables["LeadIntake"];
const appDataTable = backend.data.resources.tables["AppData"];

if (leadIntakeTable && appDataTable) {
  // Add environment variables
  backend.leadNotificationHandler.addEnvironment("AMPLIFY_AUTH_USERPOOL_ID", backend.auth.resources.userPool.userPoolId);
  // Create IAM policy for DynamoDB stream access
  const streamPolicy = new Policy(backend.leadNotificationHandler.stack, "LeadNotificationStreamPolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
        ],
        resources: [
          leadIntakeTable.tableStreamArn || `${leadIntakeTable.tableArn}/stream/*`
        ],
      }),
    ],
  });

  // Attach policy to Lambda role
  backend.leadNotificationHandler.resources.lambda.role?.attachInlinePolicy(streamPolicy);

  // Add SES permissions for email notifications
  const sesPolicy = new Policy(backend.leadNotificationHandler.stack, "LeadNotificationSESPolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "ses:FromAddress": "notifications@propels.ai"
          }
        }
      }),
    ],
  });

  // Add Cognito permissions to get user details
  const cognitoPolicy = new Policy(backend.leadNotificationHandler.stack, "LeadNotificationCognitoPolicy", {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cognito-idp:AdminGetUser"],
        resources: [backend.auth.resources.userPool.userPoolArn],
      }),
    ],
  });

  backend.leadNotificationHandler.resources.lambda.role?.attachInlinePolicy(sesPolicy);
  backend.leadNotificationHandler.resources.lambda.role?.attachInlinePolicy(cognitoPolicy);

  // Create EventSourceMapping to connect Lambda to DynamoDB Stream
  const eventSourceMapping = new EventSourceMapping(backend.leadNotificationHandler.stack, "LeadIntakeStreamMapping", {
    target: backend.leadNotificationHandler.resources.lambda,
    eventSourceArn: leadIntakeTable.tableStreamArn,
    startingPosition: StartingPosition.LATEST,
    batchSize: 10,
  });

  // Ensure the policies are created before the event source mapping
  eventSourceMapping.node.addDependency(streamPolicy);
  eventSourceMapping.node.addDependency(sesPolicy);
  eventSourceMapping.node.addDependency(cognitoPolicy);
}
