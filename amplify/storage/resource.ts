import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "demo-screenshots-storage",
  access: (allow) => ({
    "public/demos/{entity_id}/*": [allow.authenticated.to(["read", "write"]), allow.guest.to(["read"])],
  }),
});
