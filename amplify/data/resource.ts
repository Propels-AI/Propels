import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Demo: a
    .model({
      demoId: a.string().required(),
      itemSK: a.string().required(),
      ownerId: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      name: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      status: a.enum(["DRAFT", "PUBLISHED"]),
      createdAt: a.datetime().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      updatedAt: a.datetime().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      statusUpdatedAt: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      s3Key: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      hotspots: a.json().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      order: a.integer().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      pageUrl: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      thumbnailS3Key: a.string().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      // Lead capture (demo-level virtual step)
      leadStepIndex: a.integer().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
      // Future-proof flexible lead configuration (style, colors, blur, etc.)
      // Example: { style: "solid" | "blur" | "dim", bg: "white" | "black" | "#RRGGBB", opacity: 0.0-1.0 }
      leadConfig: a.json().authorization((allow) => [allow.ownerDefinedIn("ownerId")]),
    })
    .identifier(["demoId", "itemSK"])
    .secondaryIndexes((index) => [index("ownerId").sortKeys(["statusUpdatedAt"]).name("byOwnerStatus")])
    .authorization((allow) => [
      allow.ownerDefinedIn("ownerId").to(["create", "read", "update", "delete"]),
      allow.publicApiKey().to(["read"]),
    ]),

  PublicDemo: a
    .model({
      demoId: a.string().required(),
      itemSK: a.string().required(),
      ownerId: a.string(),
      name: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      order: a.integer(),
      s3Key: a.string(),
      thumbnailS3Key: a.string(),
      pageUrl: a.string(),
      hotspots: a.json(),
      // Public mirror of lead config (demo-level)
      leadStepIndex: a.integer(),
      // Public mirror of flexible config
      leadConfig: a.json(),
    })
    .identifier(["demoId", "itemSK"])
    .authorization((allow) => [
      allow.publicApiKey().to(["read"]),
      allow.ownerDefinedIn("ownerId").to(["create", "update", "delete"]),
    ]),

  Waitlist: a
    .model({
      source: a.string().required(),
      timestampEmail: a.string().required(),
      email: a.string().required(),
      createdAt: a.datetime(),
    })
    .identifier(["source", "timestampEmail"])
    .authorization((allow) => [allow.publicApiKey().to(["create"])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
