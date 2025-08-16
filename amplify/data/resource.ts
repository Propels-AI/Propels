import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Demo: a.model({
    demoId: a.string().required(),
    itemSK: a.string().required(),
    ownerId: a.string().authorization((allow) => [allow.owner()]),
    name: a.string().authorization((allow) => [allow.owner()]),
    status: a.enum(['DRAFT', 'PUBLISHED']),
    createdAt: a.datetime().authorization((allow) => [allow.owner()]),
    updatedAt: a.datetime().authorization((allow) => [allow.owner()]),
    statusUpdatedAt: a.string().authorization((allow) => [allow.owner()]),
    s3Key: a.string().authorization((allow) => [allow.owner()]),
    hotspots: a.json().authorization((allow) => [allow.owner()]),
  })
  .identifier(['demoId', 'itemSK'])
  .secondaryIndexes((index) => [
    index('ownerId').sortKeys(['statusUpdatedAt']).name('byOwnerStatus')
  ])
  .authorization((allow) => [
    allow.owner().to(['create', 'read', 'update', 'delete']),
    allow.publicApiKey().to(['read']),
  ]),

  Waitlist: a.model({
    source: a.string().required(),
    timestampEmail: a.string().required(),
    email: a.string().required(),
    createdAt: a.datetime(),
  })
  .identifier(['source', 'timestampEmail'])
  .authorization((allow) => [
    allow.publicApiKey().to(['create'])
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
