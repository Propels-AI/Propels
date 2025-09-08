import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

// - AppData (private, userPool): single-table modeling for owner data (demos, steps, leads, templates, settings, versions)
//   PK/SK with rich prefixes, GSIs for owner listings. Strictly NO public access on this table.
// - PublicMirror (public, apiKey read-only): minimal mirror of demos for public consumption (embed/player)
// - LeadIntake (public, apiKey create-only): write path for anonymous/public lead submissions

const schema = a.schema({
  AppData: a
    .model({
      // Core keys
      PK: a.string().required(),
      SK: a.string().required(),

      // Common attributes
      entityType: a.string(),
      ownerId: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),

      // Demo metadata fields
      name: a.string(),
      status: a.enum(["DRAFT", "PUBLISHED"]),
      statusUpdatedAt: a.string(),
      leadStepIndex: a.integer(),
      leadConfig: a.json(),
      leadUseGlobal: a.boolean(),
      hotspotStyle: a.json(),

      // Demo step fields
      s3Key: a.string(),
      thumbnailS3Key: a.string(),
      pageUrl: a.string(),
      order: a.integer(),
      hotspots: a.json(),

      // Lead submission fields (owner-readable copy)
      email: a.string(),
      fields: a.json(),
      stepIndex: a.integer(),
      source: a.string(),
      userAgent: a.string(),
      referrer: a.string(),

      // Owner settings/templates
      templateId: a.string(),
      nameTemplate: a.string(),

      // GSI attributes
      GSI1PK: a.string(),
      GSI1SK: a.string(),
      GSI2PK: a.string(),
      GSI2SK: a.string(),
      GSI3PK: a.string(),
      GSI3SK: a.string(),

      // Versioning helper
      currentVersion: a.integer(),
    })
    .identifier(["PK", "SK"]) // single-table keys
    .secondaryIndexes((index) => [
      index("GSI1PK").sortKeys(["GSI1SK"]).name("GSI1_byOwnerStatus"),
      index("GSI2PK").sortKeys(["GSI2SK"]).name("GSI2_leadsByOwner"),
      index("GSI3PK").sortKeys(["GSI3SK"]).name("GSI3_templatesByOwner"),
    ])
    .authorization((allow) => [
      allow.ownerDefinedIn("ownerId").to(["create", "read", "update", "delete"]),
      // NO public access here to ensure strict least-privilege on owner data
    ]),

  // PUBLIC read-only mirror for demos
  PublicMirror: a
    .model({
      PK: a.string().required(), // "PUB#<demoId>"
      SK: a.string().required(), // "METADATA" | "STEP#..."

      // minimal mirror attributes
      ownerId: a.string(),
      name: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      order: a.integer(),
      s3Key: a.string(),
      thumbnailS3Key: a.string(),
      pageUrl: a.string(),
      hotspots: a.json(),
      hotspotStyle: a.json(),
      leadStepIndex: a.integer(),
      leadConfig: a.json(),
    })
    .identifier(["PK", "SK"])
    .authorization((allow) => [
      allow.publicApiKey().to(["read"]), // public can only read
      allow.ownerDefinedIn("ownerId").to(["create", "update", "delete"]), // owners manage the mirror
    ]),

  // PUBLIC create path for leads (anonymous submissions)
  LeadIntake: a
    .model({
      demoId: a.string().required(),
      itemSK: a.string().required(), // "LEAD#<ISO>"
      ownerId: a.string(),
      email: a.string(),
      fields: a.json(),
      pageUrl: a.string(),
      stepIndex: a.integer(),
      source: a.string(),
      userAgent: a.string(),
      referrer: a.string(),
      createdAt: a.datetime(),
    })
    .identifier(["demoId", "itemSK"]) // simple, isolated write path
    .secondaryIndexes((index) => [index("ownerId").sortKeys(["createdAt"]).name("leadsByOwner")])
    .authorization((allow) => [
      allow.publicApiKey().to(["create"]), // public create only
      allow.ownerDefinedIn("ownerId").to(["read", "delete"]), // owner can read/delete their leads
    ]),
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
