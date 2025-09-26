import { defineFunction } from "@aws-amplify/backend";

export const leadNotificationHandler = defineFunction({
  name: "lead-notification-handler",
  entry: "./handler.ts",
  resourceGroupName: "data",
  environment: {
    NOTIFICATION_EMAIL: "notifications@propels.ai",
  },
});
