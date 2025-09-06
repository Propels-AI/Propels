import { generateClient } from "aws-amplify/data";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";

function getModels() {
  // Use explicit userPool auth for private Demo reads/writes to avoid intermittent apiKey fallbacks
  console.debug("[api/demos] creating data client via generateClient({ authMode: 'userPool' })...");
  const client = generateClient({ authMode: "userPool" as any });
  const models: any = (client as any).models;
  if (!models) {
    throw new Error("Amplify Data models unavailable after generateClient(). Check Amplify.configure outputs.data");
  }
  return models;
}

// Persist editor hotspot styling config to METADATA so the editor can restore it later
export async function updateDemoStyleConfig(params: {
  demoId: string;
  hotspotStyle: {
    dotSize: number;
    dotColor: string;
    dotStrokePx: number;
    dotStrokeColor: string;
    animation: "none" | "pulse" | "breathe" | "fade";
  };
}): Promise<void> {
  const { demoId, hotspotStyle } = params;
  const models = getModels();
  const payload: any = {
    demoId,
    itemSK: "METADATA",
  };
  try {
    payload.hotspotStyle = JSON.stringify(hotspotStyle);
  } catch (e) {
    console.warn("[api/demos] Failed to stringify hotspotStyle; omitting", e);
  }
  const res = await models.Demo.update(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `updateDemoStyleConfig failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function updateDemoLeadConfig(params: {
  demoId: string;
  leadStepIndex: number | null;
  leadConfig?: any;
  leadUseGlobal?: boolean;
}): Promise<void> {
  const { demoId, leadStepIndex, leadConfig, leadUseGlobal } = params;
  const models = getModels();
  const payload: any = {
    demoId,
    itemSK: "METADATA",
    leadStepIndex,
  };
  if (leadConfig !== undefined) {
    try {
      payload.leadConfig = typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig);
    } catch (e) {
      console.warn("[api/demos] Failed to stringify leadConfig; omitting", e);
    }
  }
  if (typeof leadUseGlobal === "boolean") {
    payload.leadUseGlobal = leadUseGlobal;
  }
  const res = await models.Demo.update(payload);
  console.log("[api/demos] updateDemoLeadConfig res", res);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `updateDemoLeadConfig failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

// Global lead settings helpers
export async function getLeadSettings(): Promise<any | undefined> {
  const ownerId = await getOwnerId();
  if (!ownerId) return undefined;
  const models = getModels();
  if (!(models as any).LeadSettings?.get) return undefined;
  const res = await (models as any).LeadSettings.get({ ownerId });
  return (res as any)?.data;
}

export async function upsertLeadSettings(leadConfig: any): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not signed in");
  const models = getModels();
  const payload: any = { ownerId, updatedAt: new Date().toISOString() };
  try {
    payload.leadConfig = typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig);
  } catch (e) {
    console.warn("[api/demos] Failed to stringify leadSettings.leadConfig; omitting", e);
  }
  // Try create then update on condition fail
  try {
    const res = await (models as any).LeadSettings.create(payload);
    if (!(res as any)?.data && (res as any)?.errors?.length) throw new Error("create failed");
  } catch {
    const upd = await (models as any).LeadSettings.update(payload);
    if (!(upd as any)?.data && (upd as any)?.errors?.length) throw new Error("update failed");
  }
}

// Lead templates API
export async function listLeadTemplates(): Promise<
  Array<{ templateId: string; name: string; leadConfig: any; updatedAt?: string }>
> {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const models = getModels();
  if (!(models as any).LeadTemplate?.list) return [];
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (models as any).LeadTemplate.list({ filter: { ownerId: { eq: ownerId } }, nextToken });
    items = items.concat((res as any)?.data ?? []);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  return items.map((i: any) => ({
    templateId: i.templateId,
    name: i.name,
    leadConfig: i.leadConfig,
    updatedAt: i.updatedAt,
  }));
}

export async function saveLeadTemplate(name: string, leadConfig: any): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not signed in");
  const models = getModels();
  const now = new Date().toISOString();
  const templateId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  const payload: any = {
    ownerId,
    templateId,
    name,
    leadConfig: typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig),
    createdAt: now,
    updatedAt: now,
  };
  const res = await (models as any).LeadTemplate.create(payload);
  if (!(res as any)?.data && (res as any)?.errors?.length) throw new Error("saveLeadTemplate failed");
}

// List captured leads for a demo (owner-only)
export async function listLeadSubmissions(demoId: string): Promise<
  Array<{
    demoId: string;
    itemSK: string;
    ownerId?: string;
    email?: string;
    fields?: any;
    pageUrl?: string;
    stepIndex?: number;
    source?: string;
    userAgent?: string;
    referrer?: string;
    createdAt?: string;
  }>
> {
  const models = getModels();
  if (!(models as any).LeadSubmission?.list) return [];
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (models as any).LeadSubmission.list({ filter: { demoId: { eq: demoId } }, nextToken });
    const page = (res as any)?.data ?? [];
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  return items;
}

// Public create: store a lead submission under demoId (apiKey auth)
export async function createLeadSubmissionPublic(params: {
  demoId: string;
  ownerId?: string;
  email?: string;
  fields?: any;
  pageUrl?: string;
  stepIndex?: number;
  source?: string;
  userAgent?: string;
  referrer?: string;
  createdAt?: string;
}): Promise<void> {
  const client = generateClient({ authMode: "apiKey" as any });
  const models: any = (client as any).models;
  if (!models?.LeadSubmission) throw new Error("LeadSubmission model not available");
  const now = params.createdAt || new Date().toISOString();
  const itemSK = `LEAD#${now}`;
  const payload: any = {
    demoId: params.demoId,
    itemSK,
    ownerId: params.ownerId,
    email: params.email,
    fields: params.fields ? JSON.stringify(params.fields) : undefined,
    pageUrl: params.pageUrl,
    stepIndex: params.stepIndex,
    source: params.source,
    userAgent: params.userAgent,
    referrer: params.referrer,
    createdAt: now,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  const res = await models.LeadSubmission.create(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createLeadSubmissionPublic failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data"}`
    );
  }
}

function getPublicModels() {
  console.debug("[api/demos] creating PUBLIC data client via generateClient({ authMode: 'apiKey' })...");
  const client = generateClient({ authMode: "apiKey" as any });
  const models: any = (client as any).models;
  if (!models) {
    throw new Error(
      "Amplify Data models unavailable after generateClient() for public. Check Amplify.configure outputs.data"
    );
  }
  return models;
}

function getPublicDemoModelsForPrivate() {
  // Public API access to private Demo model (schema allows public read)
  console.debug("[api/demos] creating PUBLIC client for private Demo via generateClient({ authMode: 'apiKey' })...");
  const client = generateClient({ authMode: "apiKey" as any });
  const models: any = (client as any).models;
  if (!models) {
    throw new Error("Amplify Data models unavailable for public Demo client");
  }
  return models;
}

export async function createPublicDemoMetadata(params: {
  demoId: string;
  ownerId?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  leadStepIndex?: number | null;
  leadConfig?: any;
}): Promise<void> {
  const models = getModels();
  if (!models.PublicDemo) {
    throw new Error(
      "PublicDemo model is not available. Did you run 'amplify push' and regenerate amplify_outputs.json?"
    );
  }
  let ownerId = params.ownerId;
  if (!ownerId) {
    try {
      const u = await getCurrentUser();
      ownerId = (u as any)?.username || (u as any)?.userId;
    } catch {}
  }
  const payload: any = {
    demoId: params.demoId,
    itemSK: "METADATA",
    ownerId,
    name: params.name,
    createdAt: params.createdAt ?? new Date().toISOString(),
    updatedAt: params.updatedAt ?? new Date().toISOString(),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  // Attach lead fields when provided
  if (params.leadStepIndex !== undefined) payload.leadStepIndex = params.leadStepIndex;
  if (params.leadConfig !== undefined) {
    try {
      payload.leadConfig =
        typeof params.leadConfig === "string" ? params.leadConfig : JSON.stringify(params.leadConfig);
    } catch (e) {
      console.warn("[api/demos] Failed to stringify public leadConfig; omitting", e);
    }
  }

  const res = await models.PublicDemo.create(payload);
  const errs = (res as any)?.errors as any[] | undefined;
  if (!res?.data || (errs && errs.length)) {
    const message = errs?.map((e: any) => e?.message).join(", ") || "no data returned";
    // If item already exists (ConditionalCheckFailed), fallback to update to be idempotent
    if (/ConditionalCheckFailed/i.test(message)) {
      const upd = await models.PublicDemo.update(payload);
      if (!upd?.data || (upd as any)?.errors?.length) {
        throw new Error(
          `createPublicDemoMetadata->update fallback failed: ${
            (upd as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"
          }`
        );
      }
      return;
    }
    throw new Error(`createPublicDemoMetadata failed: ${message}`);
  }
}

export async function createPublicDemoStep(params: {
  demoId: string;
  stepId: string;
  s3Key?: string;
  order?: number;
  pageUrl?: string;
  thumbnailS3Key?: string;
  hotspots?: any;
  ownerId?: string;
}): Promise<void> {
  const models = getModels();
  if (!models.PublicDemo) {
    throw new Error(
      "PublicDemo model is not available. Did you run 'amplify push' and regenerate amplify_outputs.json?"
    );
  }
  let ownerId = params.ownerId;
  if (!ownerId) {
    try {
      const u = await getCurrentUser();
      ownerId = (u as any)?.username || (u as any)?.userId;
    } catch {}
  }
  const payload: Record<string, any> = {
    demoId: params.demoId,
    itemSK: `STEP#${params.stepId}`,
    ownerId,
    s3Key: params.s3Key,
    order: params.order,
    pageUrl: params.pageUrl,
    thumbnailS3Key: params.thumbnailS3Key,
  };
  if (params.hotspots !== undefined) {
    try {
      payload.hotspots = typeof params.hotspots === "string" ? params.hotspots : JSON.stringify(params.hotspots);
    } catch (e) {
      console.warn("[api/demos] Failed to stringify public hotspots; omitting", e);
    }
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  const res = await models.PublicDemo.create(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createPublicDemoStep failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function listPublicDemoItems(demoId: string) {
  const models = getPublicModels();
  if (!models.PublicDemo) {
    throw new Error("PublicDemo model is not available. Backend schema not deployed or outputs not updated.");
  }
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await models.PublicDemo.list({ filter: { demoId: { eq: demoId } }, nextToken });
    const page = (res as any)?.data ?? [];
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  for (const it of items) {
    if (typeof (it as any).hotspots === "string") {
      try {
        (it as any).hotspots = JSON.parse((it as any).hotspots);
      } catch {}
    }
  }
  return items;
}

export async function deletePublicDemoItems(demoId: string) {
  const models = getModels();
  if (!models.PublicDemo) {
    throw new Error("PublicDemo model is not available. Backend schema not deployed or outputs not updated.");
  }
  const listRes = await models.PublicDemo.list({ filter: { demoId: { eq: demoId } } });
  const items: any[] = listRes?.data || [];
  for (const it of items) {
    await models.PublicDemo.delete({ demoId: it.demoId, itemSK: it.itemSK });
  }
}

export async function mirrorDemoToPublic(
  demoId: string,
  overrides?: { name?: string; leadStepIndex?: number | null; leadConfig?: any }
): Promise<void> {
  console.log("[api/demos] mirrorDemoToPublic START", { demoId, overrides });
  const now = new Date().toISOString();
  const items = await listDemoItems(demoId);
  if (!Array.isArray(items) || items.length === 0) {
    console.warn("[api/demos] mirrorDemoToPublic: no private items found");
    return;
  }
  const meta = items.find((it: any) => it.itemSK === "METADATA");
  if (meta) {
    // Resolve effective lead config: global vs local
    let effectiveLeadConfig: any =
      overrides && "leadConfig" in overrides ? overrides.leadConfig : (meta as any).leadConfig;
    try {
      if ((meta as any).leadUseGlobal === true && (overrides === undefined || !("leadConfig" in overrides))) {
        const global = await getLeadSettings();
        if (global && global.leadConfig) effectiveLeadConfig = global.leadConfig;
      }
    } catch (e) {
      console.warn("[api/demos] mirror: failed to resolve global lead settings (non-fatal)", e);
    }
    await createPublicDemoMetadata({
      demoId,
      name: overrides?.name ?? meta.name,
      createdAt: meta.createdAt,
      updatedAt: now,
      leadStepIndex:
        overrides && "leadStepIndex" in overrides ? (overrides.leadStepIndex ?? null) : (meta.leadStepIndex ?? null),
      leadConfig: effectiveLeadConfig ?? undefined,
    });
  } else {
    console.warn("[api/demos] mirrorDemoToPublic: METADATA missing");
  }
  const steps = items.filter((it: any) => typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"));
  console.log("[api/demos] mirrorDemoToPublic: steps=", steps.length);
  for (const step of steps) {
    let hotspots: any = undefined;
    if (typeof step.hotspots === "string") {
      try {
        hotspots = JSON.parse(step.hotspots);
      } catch {}
    } else if (step.hotspots) {
      hotspots = step.hotspots;
    }
    await createPublicDemoStep({
      demoId,
      stepId: step.itemSK.substring("STEP#".length),
      s3Key: step.s3Key,
      order: step.order,
      pageUrl: step.pageUrl,
      thumbnailS3Key: step.thumbnailS3Key,
      hotspots,
    });
  }
  console.log("[api/demos] mirrorDemoToPublic DONE");
}

export async function renameDemo(demoId: string, name: string): Promise<void> {
  const models = getModels();
  const now = new Date().toISOString();
  const payload = {
    demoId,
    itemSK: "METADATA",
    name,
    updatedAt: now,
  } as any;
  console.log("[api/demos] renameDemo ->", payload);
  const res = await models.Demo.update(payload);
  console.log("[api/demos] renameDemo res", res);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `renameDemo failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function setDemoStatus(demoId: string, status: "DRAFT" | "PUBLISHED"): Promise<void> {
  const models = getModels();
  const now = new Date().toISOString();
  const payload = {
    demoId,
    itemSK: "METADATA",
    status,
    statusUpdatedAt: now,
    updatedAt: now,
  } as any;
  console.log("[api/demos] setDemoStatus ->", payload);
  const res = await models.Demo.update(payload);
  console.log("[api/demos] setDemoStatus res", res);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `setDemoStatus failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }

  try {
    if (status === "PUBLISHED") {
      const items = await listDemoItems(demoId);
      if (!Array.isArray(items)) return;
      const metadata = items.find((it: any) => it.itemSK === "METADATA");
      if (metadata) {
        await createPublicDemoMetadata({
          demoId,
          name: metadata.name,
          createdAt: metadata.createdAt,
          updatedAt: now,
          leadStepIndex: metadata.leadStepIndex ?? null,
          leadConfig: metadata.leadConfig ?? undefined,
        });
      }
      const steps = items.filter((it: any) => typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"));
      console.log("[api/demos] setDemoStatus: steps to mirror:", steps.length);
      for (const step of steps) {
        let hotspots: any = undefined;
        if (typeof step.hotspots === "string") {
          try {
            hotspots = JSON.parse(step.hotspots);
          } catch {}
        } else if (step.hotspots) {
          hotspots = step.hotspots;
        }
        await createPublicDemoStep({
          demoId,
          stepId: step.itemSK.substring("STEP#".length),
          s3Key: step.s3Key,
          order: step.order,
          pageUrl: step.pageUrl,
          thumbnailS3Key: step.thumbnailS3Key,
          hotspots,
        });
      }
      console.log("[api/demos] setDemoStatus: client mirror complete");
    } else if (status === "DRAFT") {
      console.log("[api/demos] setDemoStatus: removing from PublicDemo (unpublish)...");
      await deletePublicDemoItems(demoId);
    }
  } catch (mirrorErr) {
    console.error("[api/demos] setDemoStatus mirror error:", mirrorErr);
  }
}

export async function deleteDemo(demoId: string): Promise<void> {
  const models = getModels();
  console.log("[api/demos] deleteDemo -> list items for", demoId);
  const listRes = await models.Demo.list({ filter: { demoId: { eq: demoId } } });
  const items: any[] = listRes?.data || [];
  console.log("[api/demos] deleteDemo found", items.length, "items");
  for (const it of items) {
    try {
      const delRes = await models.Demo.delete({ demoId: it.demoId, itemSK: it.itemSK });
      console.log("[api/demos] deleted", { demoId: it.demoId, itemSK: it.itemSK, res: delRes });
    } catch (e) {
      console.error("[api/demos] delete item failed", { demoId: it.demoId, itemSK: it.itemSK }, e);
      throw e;
    }
  }
}

export type Hotspot = {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  xNorm?: number;
  yNorm?: number;
  tooltip?: string;
};

export async function createDemoMetadata(params: {
  demoId: string;
  ownerId?: string; // owner comes from auth context; still persisted as attribute
  name?: string;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<void> {
  const { demoId, ownerId, name, status = "DRAFT" } = params;
  const now = new Date().toISOString();
  const models = getModels();
  const res = await models.Demo.create({
    demoId,
    itemSK: "METADATA",
    ownerId,
    name,
    status,
    createdAt: now,
    updatedAt: now,
    statusUpdatedAt: now,
  });
  console.log("[api/demos] createDemoMetadata result", res);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createDemoMetadata failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function createDemoStep(params: {
  demoId: string;
  stepId: string;
  s3Key: string;
  hotspots?: Hotspot[];
  order: number;
  pageUrl?: string;
  thumbnailS3Key?: string;
  ownerId?: string;
}): Promise<void> {
  const { demoId, stepId, s3Key, hotspots, order, pageUrl, thumbnailS3Key, ownerId } = params;
  const models = getModels();
  const payload: Record<string, any> = {
    demoId,
    itemSK: `STEP#${stepId}`,
    ownerId,
    s3Key,
    order,
    pageUrl,
    thumbnailS3Key,
  };
  if (Array.isArray(hotspots) && hotspots.length > 0) {
    try {
      payload.hotspots = JSON.stringify(hotspots);
    } catch (e) {
      console.warn("[api/demos] Failed to stringify hotspots; omitting", e);
    }
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const res = await models.Demo.create(payload);
  console.log("[api/demos] createDemoStep result", { stepId, res });
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createDemoStep failed for ${stepId}: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function updateDemoStepHotspots(params: {
  demoId: string;
  stepId: string;
  hotspots?: Hotspot[];
}): Promise<void> {
  const { demoId, stepId, hotspots } = params;
  const models = getModels();
  const payload: Record<string, any> = {
    demoId,
    itemSK: `STEP#${stepId}`,
  };
  if (Array.isArray(hotspots)) {
    try {
      payload.hotspots = JSON.stringify(hotspots);
    } catch (e) {
      console.warn("[api/demos] Failed to stringify hotspots for update; omitting", e);
    }
  }
  const res = await models.Demo.update(payload);
  console.log("[api/demos] updateDemoStepHotspots result", { stepId, res });
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `updateDemoStepHotspots failed for ${stepId}: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function listDemoItems(demoId: string) {
  console.debug("[api/demos] listDemoItems ->", { demoId });
  try {
    // Ensure auth session is ready so userPool reads return full fields
    try {
      await fetchAuthSession();
    } catch (e) {
      console.warn("[api/demos] fetchAuthSession failed; will attempt public read", e);
    }
    try {
      // Debug: log current identity used for owner-based auth
      try {
        const u = await getCurrentUser();
        console.debug("[api/demos] identity (username,userId):", (u as any)?.username, (u as any)?.userId);
      } catch (e) {
        console.debug("[api/demos] identity unavailable yet", e);
      }
      const models = getModels();
      let items: any[] = [];
      let nextToken: any = undefined;
      do {
        const res = await models.Demo.list({ filter: { demoId: { eq: demoId } }, nextToken });
        console.debug("[api/demos] listDemoItems page (userPool):", {
          count: (res as any)?.data?.length ?? 0,
          hasNext: !!(res as any)?.nextToken,
        });
        items = items.concat((res as any)?.data ?? []);
        nextToken = (res as any)?.nextToken;
      } while (nextToken);
      if (Array.isArray(items) && items.length > 0) return items;
      // Probe: try direct METADATA get via userPool to see if item exists but list is filtered
      try {
        if ((models as any).Demo?.get) {
          const metaRes = await (models as any).Demo.get({ demoId, itemSK: "METADATA" });
          console.debug("[api/demos] probe get(METADATA) (userPool):", metaRes);
          const meta = (metaRes as any)?.data;
          // If we can get METADATA directly, fetch steps via beginsWith filter and aggregate
          if (meta) {
            let stepItems: any[] = [];
            let ntSteps: any = undefined;
            do {
              const stepRes = await models.Demo.list({
                filter: { demoId: { eq: demoId }, itemSK: { beginsWith: "STEP#" } },
                nextToken: ntSteps,
              });
              const page = (stepRes as any)?.data ?? [];
              stepItems = stepItems.concat(page);
              ntSteps = (stepRes as any)?.nextToken;
            } while (ntSteps);
            console.debug("[api/demos] step list via beginsWith count:", stepItems.length);
            if (stepItems.length > 0) {
              return [meta, ...stepItems];
            }
            // If no steps, at least return METADATA so the editor can render shell
            return [meta];
          }
        }
      } catch (probeErr) {
        console.warn("[api/demos] probe get(METADATA) (userPool) failed", probeErr);
      }
      // Fallback A: if userPool returned zero items (e.g., ownerId mismatch), try public apiKey read on private Demo
      try {
        const pubDemoModels = getPublicDemoModelsForPrivate();
        let pubItems: any[] = [];
        let nextTokenPub: any = undefined;
        do {
          const pubRes = await pubDemoModels.Demo.list({ filter: { demoId: { eq: demoId } }, nextToken: nextTokenPub });
          pubItems = pubItems.concat((pubRes as any)?.data ?? []);
          nextTokenPub = (pubRes as any)?.nextToken;
        } while (nextTokenPub);
        console.debug("[api/demos] listDemoItems res (Demo via apiKey fallback after empty):", {
          count: pubItems?.length,
        });
        if (Array.isArray(pubItems) && pubItems.length > 0) return pubItems;
        // Probe: try direct METADATA get via apiKey client
        try {
          if ((pubDemoModels as any).Demo?.get) {
            const metaResPub = await (pubDemoModels as any).Demo.get({ demoId, itemSK: "METADATA" });
            console.debug("[api/demos] probe get(METADATA) (apiKey/private Demo):", metaResPub);
          }
        } catch (probePubErr) {
          console.warn("[api/demos] probe get(METADATA) (apiKey/private Demo) failed", probePubErr);
        }
      } catch (publicDemoFallbackErr) {
        console.warn("[api/demos] Demo apiKey fallback after empty failed", publicDemoFallbackErr);
      }
      // Fallback B: finally, try PublicDemo mirror if available
      try {
        const pubItems = await listPublicDemoItems(demoId);
        console.debug("[api/demos] listDemoItems res (PublicDemo fallback after empty):", {
          count: pubItems?.length,
        });
        return pubItems;
      } catch (publicAfterEmptyErr) {
        console.warn("[api/demos] PublicDemo fallback after empty failed", publicAfterEmptyErr);
        return items;
      }
    } catch (userErr) {
      console.warn("[api/demos] userPool read failed; trying PublicDemo", userErr);
      const pubItems = await listPublicDemoItems(demoId);
      console.debug("[api/demos] listDemoItems res (PublicDemo after error):", { count: pubItems?.length });
      return pubItems;
    }
  } catch (e) {
    console.error("[api/demos] listDemoItems error", e);
    throw e;
  }
}

export async function getOwnerId(): Promise<string | undefined> {
  try {
    const user = await getCurrentUser();
    // Prefer username to match default owner auth identity claim; fallback to userId (sub)
    return (user as any)?.username || user?.userId;
  } catch {
    return undefined;
  }
}

export async function listMyDemos(
  status?: "DRAFT" | "PUBLISHED"
): Promise<Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>> {
  try {
    // Ensure credentials are ready for owner-based reads
    try {
      await fetchAuthSession();
    } catch (e) {
      console.warn("[api/demos] listMyDemos: fetchAuthSession failed (continuing)", e);
    }
    const ownerId = await getOwnerId();
    console.debug("[api/demos] listMyDemos ownerId:", ownerId, "status:", status ?? "(any)");
    if (!ownerId) {
      throw new Error("Not signed in. Please sign in to view your demos.");
    }
    const models = getModels();
    const filter: any = {
      itemSK: { eq: "METADATA" },
      ownerId: { eq: ownerId },
    };
    if (status) {
      filter.status = { eq: status };
    }
    // Paginate through all pages; first page can be empty even when later pages contain data
    let all: any[] = [];
    let nextToken: any = undefined;
    do {
      const res = await models.Demo.list({ filter, nextToken });
      const page = (res as any)?.data ?? [];
      console.debug("[api/demos] listMyDemos page:", { count: page.length, hasNext: !!(res as any)?.nextToken });
      all = all.concat(page);
      nextToken = (res as any)?.nextToken;
    } while (nextToken);
    // Map and sort by updatedAt desc (fallback createdAt)
    const mapped = all.map((it: any) => ({
      id: it.demoId,
      name: it.name,
      status: it.status,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));
    mapped.sort((a: any, b: any) => {
      const aT = Date.parse(a.updatedAt || a.createdAt || 0);
      const bT = Date.parse(b.updatedAt || b.createdAt || 0);
      return bT - aT;
    });
    return mapped;
  } catch (e: any) {
    console.error("[api/demos] listMyDemos error:", e);
    const err = new Error(
      `Failed to list demos. ${e?.message || e?.toString?.() || "Unknown error"}. Is Amplify configured and user signed in?`
    );
    throw err;
  }
}
