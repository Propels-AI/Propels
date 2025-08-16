import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'demo-screenshots-storage',
  access: (allow) => ({
    'public/demos/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read']),
    ],
  }),
});