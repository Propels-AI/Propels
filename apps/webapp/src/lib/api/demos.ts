import { generateClient } from "aws-amplify/data";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

const pkDemo = (demoId: string) => `DEMO#${demoId}`;
const pkPub = (demoId: string) => `PUB#${demoId}`;
const pkOwner = (ownerId: string) => `OWNER#${ownerId}`;

export async function getOwnerId(): Promise<string | undefined> {
  try {
    const user = await getCurrentUser();
    return (user as any)?.username || (user as any)?.userId || undefined;
  } catch {
    return undefined;
  }
}

function getPrivateModels() {
  const client = generateClient({ authMode: "userPool" as any });
  const models: any = (client as any).models;
  if (!models) {
    throw new Error("Amplify Data models unavailable after generateClient() for private models");
  }
  if (!(models as any).AppData) {
    throw new Error("AppData model unavailable. Did you push the new schema?");
  }
  return models as any;
}

function getPublicMirrorWriteModels() {
  const client = generateClient({ authMode: "userPool" as any });
  const models: any = (client as any).models;
  if (!models || !(models as any).PublicMirror) {
    throw new Error("PublicMirror model unavailable for write. Did you push the new schema?");
  }
  return models as any;
}

function getPublicMirrorModels() {
  const client = generateClient({ authMode: "apiKey" as any });
  const models: any = (client as any).models;
  if (!models || !(models as any).PublicMirror) {
    throw new Error("PublicMirror model unavailable. Did you push the new schema?");
  }
  return models as any;
}

function getLeadIntakeWriteModels() {
  const client = generateClient({ authMode: "apiKey" as any });
  const models: any = (client as any).models;
  if (!models || !(models as any).LeadIntake) {
    throw new Error("LeadIntake model unavailable. Did you push the new schema?");
  }
  return models as any;
}

function getLeadIntakeReadModels() {
  const client = generateClient({ authMode: "userPool" as any });
  const models: any = (client as any).models;
  if (!models || !(models as any).LeadIntake) {
    throw new Error("LeadIntake model unavailable. Did you push the new schema?");
  }
  return models as any;
}

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
  const models = getPrivateModels();
  const payload: any = {
    PK: pkDemo(demoId),
    SK: "METADATA",
  };
  try {
    payload.hotspotStyle = JSON.stringify(hotspotStyle);
  } catch (e) {}
  const res = await models.AppData.update(payload);
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
  const models = getPrivateModels();
  const payload: any = { PK: pkDemo(demoId), SK: "METADATA", leadStepIndex };
  if (leadConfig !== undefined) {
    try {
      const lc = typeof leadConfig === "string" ? JSON.parse(leadConfig) : leadConfig;
      const hasFields = Array.isArray(lc?.fields) && lc.fields.length > 0;
      if (hasFields) {
        payload.leadConfig = typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig);
      } else {
      }
    } catch (e) {}
  }
  if (typeof leadUseGlobal === "boolean") {
    payload.leadUseGlobal = leadUseGlobal;
  }
  const res = await models.AppData.update(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `updateDemoLeadConfig failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function getLeadSettings(): Promise<any | undefined> {
  const ownerId = await getOwnerId();
  if (!ownerId) return undefined;
  const models = getPrivateModels();
  const res = await (models as any).AppData.get({ PK: pkOwner(ownerId), SK: "LEADSETTINGS" });
  return (res as any)?.data;
}

export async function upsertLeadSettings(leadConfig: any): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not signed in");
  const models = getPrivateModels();
  const payload: any = { PK: pkOwner(ownerId), SK: "LEADSETTINGS", ownerId, updatedAt: new Date().toISOString() };
  try {
    payload.leadConfig = typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig);
  } catch (e) {}
  try {
    const res = await (models as any).AppData.create(payload);
    if (!(res as any)?.data && (res as any)?.errors?.length) throw new Error("create failed");
  } catch {
    const upd = await (models as any).AppData.update(payload);
    if (!(upd as any)?.data && (upd as any)?.errors?.length) throw new Error("update failed");
  }
}

export async function listLeadTemplates(): Promise<
  Array<{ templateId: string; name: string; leadConfig: any; updatedAt?: string }>
> {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const models = getPrivateModels();
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (models as any).AppData.list({
      filter: { PK: { eq: pkOwner(ownerId) }, SK: { beginsWith: "TEMPLATE#" } },
      nextToken,
    });
    items = items.concat((res as any)?.data ?? []);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  return items.map((i: any) => ({
    templateId: i.SK?.split("TEMPLATE#")[1] ?? i.templateId,
    name: i.nameTemplate ?? i.name,
    leadConfig: i.leadConfig,
    updatedAt: i.updatedAt,
  }));
}

export async function saveLeadTemplate(name: string, leadConfig: any): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error("Not signed in");
  const models = getPrivateModels();
  const now = new Date().toISOString();
  const templateId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  const payload: any = {
    PK: pkOwner(ownerId),
    SK: `TEMPLATE#${templateId}`,
    ownerId,
    nameTemplate: name,
    leadConfig: typeof leadConfig === "string" ? leadConfig : JSON.stringify(leadConfig),
    createdAt: now,
    updatedAt: now,
    GSI3PK: `OWNER#${ownerId}#TEMPLATE`,
    GSI3SK: `TS#${now}`,
  };
  const res = await (models as any).AppData.create(payload);
  if (!(res as any)?.data && (res as any)?.errors?.length) throw new Error("saveLeadTemplate failed");
}

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
  const currentOwnerId = await getOwnerId();
  if (!currentOwnerId) {
    const err = new Error("Forbidden: not signed in");
    (err as any).status = 401;
    throw err;
  }
  let demoOwnerId: string | undefined;
  try {
    const models = getPrivateModels();
    const metaRes = await (models as any).AppData.get({ PK: pkDemo(demoId), SK: "METADATA" });
    demoOwnerId = (metaRes as any)?.data?.ownerId;
  } catch {}
  if (!demoOwnerId) {
    try {
      const pubModels = getPublicMirrorModels();
      const metaRes = await (pubModels as any).PublicMirror.get({ PK: pkPub(demoId), SK: "METADATA" });
      demoOwnerId = (metaRes as any)?.data?.ownerId;
    } catch {}
  }
  if (!demoOwnerId || demoOwnerId !== currentOwnerId) {
    const err = new Error("Forbidden: not the owner of this demo");
    (err as any).status = 403;
    throw err;
  }

  const li = getLeadIntakeReadModels();
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (li as any).LeadIntake.list({ filter: { demoId: { eq: demoId } }, nextToken });
    const page = (res as any)?.data ?? [];
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  return items;
}

export async function createLeadSubmissionPublic(params: {
  demoId: string;
  email?: string;
  fields?: any;
  pageUrl?: string;
  stepIndex?: number;
  source?: string;
  userAgent?: string;
  referrer?: string;
  createdAt?: string;
}): Promise<void> {
  const now = params.createdAt || new Date().toISOString();
  const itemSK = `LEAD#${now}`;

  const pubModels = getPublicMirrorModels();
  let ownerId: string | undefined;
  try {
    const metaRes = await (pubModels as any).PublicMirror.get({ PK: pkPub(params.demoId), SK: "METADATA" });
    ownerId = (metaRes as any)?.data?.ownerId;
  } catch {}
  if (!ownerId) throw new Error("Lead submission failed: demo not found or owner unavailable");

  const li = getLeadIntakeWriteModels();
  const payload: any = {
    demoId: params.demoId,
    itemSK,
    ownerId,
    email: params.email,
    fields: params.fields ? JSON.stringify(params.fields) : undefined,
    pageUrl: params.pageUrl,
    stepIndex: params.stepIndex,
    source: params.source,
    userAgent: params.userAgent,
    referrer: params.referrer,
    createdAt: now,
  };
  const sanitizeJson = (v: any) => {
    try {
      return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    } catch {
      return undefined;
    }
  };
  const fs = sanitizeJson(payload.fields);
  if (
    fs === undefined ||
    fs === null ||
    (typeof fs === "object" && !Array.isArray(fs) && Object.keys(fs).length === 0)
  ) {
    delete payload.fields;
  } else {
    payload.fields = fs;
  }
  Object.keys(payload).forEach((k) => (payload[k] === undefined ? delete payload[k] : undefined));

  const res = await (li as any).LeadIntake.create(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createLeadSubmissionPublic failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data"}`
    );
  }
}

export async function listPrivateDemoItemsPublic(demoId: string): Promise<any[]> {
  const models = getPublicMirrorModels();
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (models as any).PublicMirror.list({ filter: { PK: { eq: pkPub(demoId) } }, nextToken });
    const page = ((res as any)?.data ?? []).map((it: any) =>
      it && it.itemSK === undefined && typeof it.SK === "string" ? { ...it, itemSK: it.SK } : it
    );
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  for (const it of items) {
    if (typeof (it as any).hotspots === "string") {
      try {
        (it as any).hotspots = JSON.parse((it as any).hotspots);
      } catch {}
    }
    if (typeof (it as any).leadConfig === "string") {
      try {
        (it as any).leadConfig = JSON.parse((it as any).leadConfig);
      } catch {}
    }
    if (typeof (it as any).hotspotStyle === "string") {
      try {
        (it as any).hotspotStyle = JSON.parse((it as any).hotspotStyle);
      } catch {}
    }
  }
  return items;
}

export async function createPublicDemoMetadata(params: {
  demoId: string;
  ownerId?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  leadStepIndex?: number | null;
  leadConfig?: any;
  hotspotStyle?: any;
}): Promise<void> {
  const models = getPublicMirrorWriteModels();
  console.info("[mirror] PublicMirror models:", models);
  let ownerId = params.ownerId;
  if (!ownerId) {
    try {
      await fetchAuthSession();
      const u = await getCurrentUser();
      ownerId = (u as any)?.username || (u as any)?.userId;
    } catch {}
  }
  if (!ownerId) {
    throw new Error("createPublicDemoMetadata requires authenticated ownerId");
  }
  console.info("[mirror] Using ownerId:", ownerId);
  // Load existing to decide between update-first or create
  let existing: any = undefined;
  try {
    const readModels = getPublicMirrorModels();
    const ex = await (readModels as any).PublicMirror.get({ PK: pkPub(params.demoId), SK: "METADATA" });
    existing = (ex as any)?.data ?? undefined;
  } catch {}

  const base: any = {
    PK: pkPub(params.demoId),
    SK: "METADATA",
    ownerId,
    name: params.name ?? existing?.name,
    createdAt: params.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: params.updatedAt ?? new Date().toISOString(),
  };
  if (params.leadStepIndex !== undefined) base.leadStepIndex = params.leadStepIndex;
  else if (existing && existing.leadStepIndex !== undefined) base.leadStepIndex = existing.leadStepIndex;
  if (params.leadConfig !== undefined) base.leadConfig = params.leadConfig;
  else if (existing && existing.leadConfig !== undefined) base.leadConfig = existing.leadConfig;
  if (params.hotspotStyle !== undefined) base.hotspotStyle = params.hotspotStyle;
  else if (existing && existing.hotspotStyle !== undefined) base.hotspotStyle = existing.hotspotStyle;

  if (base.name === null) delete base.name;
  if (base.leadStepIndex === null) delete base.leadStepIndex;
  const leadProvided = Object.prototype.hasOwnProperty.call(params, "leadConfig");
  const styleProvided = Object.prototype.hasOwnProperty.call(params, "hotspotStyle");
  const sanitizeJson = (v: any) => {
    try {
      return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    } catch {
      return undefined;
    }
  };
  const lc = sanitizeJson(base.leadConfig);
  if (leadProvided) {
    if (lc === undefined || lc === null) {
      delete base.leadConfig;
    } else {
      base.leadConfig = typeof base.leadConfig === "string" ? base.leadConfig : JSON.stringify(lc);
    }
  } else {
    if (
      lc === undefined ||
      lc === null ||
      (typeof lc === "object" && !Array.isArray(lc) && Object.keys(lc).length === 0)
    ) {
      delete base.leadConfig;
    } else {
      base.leadConfig = typeof base.leadConfig === "string" ? base.leadConfig : JSON.stringify(lc);
    }
  }
  const hs = sanitizeJson(base.hotspotStyle);
  if (styleProvided) {
    if (hs === undefined || hs === null) {
      delete base.hotspotStyle;
    } else {
      base.hotspotStyle = typeof base.hotspotStyle === "string" ? base.hotspotStyle : JSON.stringify(hs);
    }
  } else {
    if (
      hs === undefined ||
      hs === null ||
      (typeof hs === "object" && !Array.isArray(hs) && Object.keys(hs).length === 0)
    ) {
      delete base.hotspotStyle;
    } else {
      base.hotspotStyle = typeof base.hotspotStyle === "string" ? base.hotspotStyle : JSON.stringify(hs);
    }
  }
  Object.keys(base).forEach((k) => (base[k] === undefined ? delete base[k] : undefined));

  if (existing) {
    const merged = { ...existing, ...base } as any;
    console.info("[mirror] Updating PublicMirror METADATA with merged payload:", merged);
    const upd = await (models as any).PublicMirror.update(merged);
    console.info("[mirror] PublicMirror.update response:", upd);
    const uerrs = (upd as any)?.errors as any[] | undefined;
    if (!upd?.data || (uerrs && uerrs.length)) {
      throw new Error(
        `createPublicDemoMetadata->update failed: ${uerrs?.map((e: any) => e?.message).join(", ") || "no data returned"}`
      );
    }
    return;
  }

  console.info("[mirror] Creating PublicMirror METADATA with payload:", base);
  const res = await (models as any).PublicMirror.create(base);
  console.info("[mirror] PublicMirror.create response:", res);
  const errs = (res as any)?.errors as any[] | undefined;
  if (!res?.data || (errs && errs.length)) {
    const message = errs?.map((e: any) => e?.message).join(", ") || "no data returned";
    console.error("[mirror] PublicMirror.create failed:", message, errs);
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
  const models = getPublicMirrorWriteModels();
  let ownerId = params.ownerId;
  if (!ownerId) {
    try {
      await fetchAuthSession();
      const me = await getCurrentUser();
      ownerId = (me as any)?.userId || (me as any)?.username;
    } catch {
      // ignore
    }
  }
  if (!ownerId) {
    throw new Error("createPublicDemoStep requires authenticated ownerId");
  }
  const payload: any = {
    PK: pkPub(params.demoId),
    SK: `STEP#${params.stepId}`,
    s3Key: params.s3Key,
    pageUrl: params.pageUrl,
    order: params.order,
    thumbnailS3Key: params.thumbnailS3Key,
    hotspots: Array.isArray(params.hotspots)
      ? JSON.stringify(params.hotspots)
      : params.hotspots && typeof params.hotspots === "object"
        ? JSON.stringify(params.hotspots)
        : typeof params.hotspots === "string"
          ? params.hotspots
          : undefined,
    ownerId,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  const res = await (models as any).PublicMirror.create(payload);
  const errs = (res as any)?.errors as any[] | undefined;
  if (!res?.data || (errs && errs.length)) {
    const message = errs?.map((e: any) => e?.message).join(", ") || "no data returned";
    // Handle both GraphQL-style and DynamoDB-style conditional errors
    if (/ConditionalCheckFailed/i.test(message) || /conditional request failed/i.test(message)) {
      // Preserve existing fields when updating to avoid dropping image/pageUrl/ownerId
      let prev: any = {};
      try {
        const readModels = getPublicMirrorModels();
        const ex = await (readModels as any).PublicMirror.get({
          PK: pkPub(params.demoId),
          SK: `STEP#${params.stepId}`,
        });
        prev = (ex as any)?.data ?? {};
      } catch {}
      const merged = { ...prev, ...payload } as any;
      const upd = await (models as any).PublicMirror.update(merged);
      if (!upd?.data || (upd as any)?.errors?.length) {
        throw new Error(
          `createPublicDemoStep->update fallback failed: ${
            (upd as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"
          }`
        );
      }
      return;
    }
    throw new Error(`createPublicDemoStep failed: ${message}`);
  }
}

export async function listPublicDemoItems(demoId: string) {
  const models = getPublicMirrorModels();
  let items: any[] = [];
  let nextToken: any = undefined;
  do {
    const res = await (models as any).PublicMirror.list({ filter: { PK: { eq: pkPub(demoId) } }, nextToken });
    const page = ((res as any)?.data ?? []).map((it: any) =>
      it && it.itemSK === undefined && typeof it.SK === "string" ? { ...it, itemSK: it.SK } : it
    );
    items = items.concat(page);
    nextToken = (res as any)?.nextToken;
  } while (nextToken);
  for (const it of items) {
    if (typeof (it as any).hotspots === "string") {
      try {
        (it as any).hotspots = JSON.parse((it as any).hotspots);
      } catch {}
    }
    if (typeof (it as any).leadConfig === "string") {
      try {
        (it as any).leadConfig = JSON.parse((it as any).leadConfig);
      } catch {}
    }
    if (typeof (it as any).hotspotStyle === "string") {
      try {
        (it as any).hotspotStyle = JSON.parse((it as any).hotspotStyle);
      } catch {}
    }
  }
  return items;
}

export async function deletePublicDemoItems(demoId: string) {
  const readModels = getPublicMirrorModels();
  const listRes = await (readModels as any).PublicMirror.list({ filter: { PK: { eq: pkPub(demoId) } } });
  const items: any[] = listRes?.data || [];
  for (const it of items) {
    const writeModels = getPublicMirrorWriteModels();
    await (writeModels as any).PublicMirror.delete({ PK: it.PK, SK: it.SK });
  }
}

export async function hasPublicMirror(demoId: string): Promise<boolean> {
  try {
    const models = getPublicMirrorModels();
    const res = await (models as any).PublicMirror.list({ filter: { PK: { eq: pkPub(demoId) } } });
    const items = (res as any)?.data ?? [];
    return items.length > 0;
  } catch {
    return false;
  }
}

export async function mirrorDemoToPublic(
  demoId: string,
  overrides?: { name?: string; leadStepIndex?: number | null; leadConfig?: any }
): Promise<void> {
  const now = new Date().toISOString();
  const items = await listDemoItems(demoId);
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }
  let meta = items.find(
    (it: any) =>
      (typeof it.SK === "string" && it.SK === "METADATA") || (typeof it.itemSK === "string" && it.itemSK === "METADATA")
  );
  if (!meta) {
    // Fallback to a direct read in case list results didn't include METADATA
    try {
      const models = getPrivateModels();
      const res = await (models as any).AppData.get({ PK: pkDemo(demoId), SK: "METADATA" });
      meta = (res as any)?.data ?? undefined;
      console.info("[mirror/save] fallback METADATA read:", meta ? { name: meta.name } : null);
    } catch (e) {
      console.warn("[mirror/save] fallback METADATA read failed", e);
    }
  }
  if (meta) {
    let effectiveLeadConfig: any =
      overrides && "leadConfig" in overrides ? overrides.leadConfig : (meta as any).leadConfig;
    try {
      if ((meta as any).leadUseGlobal === true && (overrides === undefined || !("leadConfig" in overrides))) {
        const global = await getLeadSettings();
        if (global && global.leadConfig) effectiveLeadConfig = global.leadConfig;
      }
    } catch (e) {}
    await createPublicDemoMetadata({
      demoId,
      name: overrides?.name ?? meta.name,
      createdAt: meta.createdAt,
      updatedAt: now,
      leadStepIndex:
        overrides && "leadStepIndex" in overrides ? (overrides.leadStepIndex ?? null) : (meta.leadStepIndex ?? null),
      leadConfig: effectiveLeadConfig ?? undefined,
      hotspotStyle: (meta as any).hotspotStyle ?? undefined,
    });
  } else {
  }
  const steps = items.filter(
    (it: any) =>
      (typeof it.SK === "string" && it.SK.startsWith("STEP#")) ||
      (typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"))
  );
  for (const step of steps) {
    // Fetch freshest version of the step to avoid eventual-consistency from list
    let freshStep: any = step;
    try {
      const models = getPrivateModels();
      const sk = (step.SK ?? step.itemSK) as string;
      const direct = await (models as any).AppData.get({ PK: pkDemo(demoId), SK: sk });
      freshStep = (direct as any)?.data ?? step;
    } catch {}

    let hotspots: any = undefined;
    if (typeof freshStep.hotspots === "string") {
      try {
        hotspots = JSON.parse(freshStep.hotspots);
      } catch {}
    } else if (freshStep.hotspots) {
      hotspots = freshStep.hotspots;
    }
    await createPublicDemoStep({
      demoId,
      stepId: (freshStep.SK ?? freshStep.itemSK).substring("STEP#".length),
      s3Key: freshStep.s3Key,
      order: freshStep.order,
      pageUrl: freshStep.pageUrl,
      thumbnailS3Key: freshStep.thumbnailS3Key,
      hotspots,
    });
  }
}

export async function renameDemo(demoId: string, name: string): Promise<void> {
  const models = getPrivateModels();
  const now = new Date().toISOString();
  const payload = {
    PK: pkDemo(demoId),
    SK: "METADATA",
    name,
    updatedAt: now,
  } as any;
  const res = await (models as any).AppData.update(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `renameDemo failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function setDemoStatus(demoId: string, status: "DRAFT" | "PUBLISHED"): Promise<void> {
  const models = getPrivateModels();
  const now = new Date().toISOString();
  const payload = {
    PK: pkDemo(demoId),
    SK: "METADATA",
    status,
    statusUpdatedAt: now,
    updatedAt: now,
    GSI1PK: `OWNER#${await getOwnerId()}#DEMO`,
    GSI1SK: `STATUS#${status}#TS#${now}`,
  } as any;
  const res = await (models as any).AppData.update(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `setDemoStatus failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }

  console.info("[setDemoStatus] AppData update completed, now starting mirror process");
  console.info("[setDemoStatus] entering try block, status:", status);
  try {
    if (status === "PUBLISHED") {
      console.info("[mirror] starting mirror for", demoId);
      const items = await listDemoItems(demoId);
      console.info("[mirror] listDemoItems returned:", items);
      if (!Array.isArray(items)) {
        console.error("[mirror] items is not an array:", items);
        return;
      }
      console.info(
        "[mirror] items found:",
        items.map((it: any) => ({ SK: it.SK, itemSK: it.itemSK, name: it.name }))
      );
      let metadata = items.find((it: any) => it?.itemSK === "METADATA" || it?.SK === "METADATA");
      console.info(
        "[mirror] metadata found:",
        metadata ? { name: (metadata as any).name, hotspotStyle: (metadata as any).hotspotStyle } : null
      );
      if (!metadata) {
        try {
          console.info("[mirror] METADATA not in list; falling back to direct read from AppData");
          const readModels = getPrivateModels();
          const direct = await (readModels as any).AppData.get({ PK: pkDemo(demoId), SK: "METADATA" });
          metadata = (direct as any)?.data ?? undefined;
          console.info(
            "[mirror] fallback METADATA:",
            metadata ? { name: (metadata as any).name, hotspotStyle: (metadata as any).hotspotStyle } : null
          );
        } catch (e) {
          console.error("[mirror] fallback read failed", e);
        }
      }
      if (metadata) {
        let effectiveLeadConfig: any = (metadata as any).leadConfig;
        try {
          if ((metadata as any).leadUseGlobal === true && !effectiveLeadConfig) {
            const global = await getLeadSettings();
            if (global && global.leadConfig) effectiveLeadConfig = global.leadConfig;
          }
        } catch (e) {}
        console.info("[mirror] creating metadata with hotspotStyle:", metadata.hotspotStyle);
        await createPublicDemoMetadata({
          demoId,
          name: metadata.name,
          createdAt: metadata.createdAt,
          updatedAt: now,
          leadStepIndex: metadata.leadStepIndex ?? null,
          leadConfig: effectiveLeadConfig ?? undefined,
          hotspotStyle: metadata.hotspotStyle ?? undefined,
        });
        console.info("[mirror] metadata created successfully");
      }
      const steps = items.filter((it: any) => typeof it.itemSK === "string" && it.itemSK.startsWith("STEP#"));
      console.info("[mirror] mirroring steps: count=", steps.length);
      for (const step of steps) {
        let hotspots: any = undefined;
        if (typeof step.hotspots === "string") {
          try {
            hotspots = JSON.parse(step.hotspots);
          } catch {}
        } else if (step.hotspots) {
          hotspots = step.hotspots;
        }
        console.info("[mirror] step", step.itemSK, {
          s3Key: step.s3Key,
          thumb: step.thumbnailS3Key,
          order: step.order,
        });
        console.info("[mirror] Creating step with payload:", {
          demoId,
          stepId: step.itemSK.substring("STEP#".length),
          s3Key: step.s3Key,
          order: step.order,
          pageUrl: step.pageUrl,
          thumbnailS3Key: step.thumbnailS3Key,
          hotspots,
        });
        await createPublicDemoStep({
          demoId,
          stepId: step.itemSK.substring("STEP#".length),
          s3Key: step.s3Key,
          order: step.order,
          pageUrl: step.pageUrl,
          thumbnailS3Key: step.thumbnailS3Key,
          hotspots,
        });
        console.info("[mirror] step created:", step.itemSK.substring("STEP#".length));
      }
    } else if (status === "DRAFT") {
      await deletePublicDemoItems(demoId);
    }
  } catch (mirrorErr) {
    console.error("[mirror] failed to mirror demo", { demoId, err: mirrorErr });
    console.error("[mirror] error details:", mirrorErr);
    console.error("[mirror] error stack:", (mirrorErr as Error)?.stack);
    // Don't throw - allow status update to succeed even if mirror fails
    // throw mirrorErr;
  }
}

export async function deleteDemo(demoId: string): Promise<void> {
  const models = getPrivateModels();
  const listRes = await (models as any).AppData.list({ filter: { PK: { eq: pkDemo(demoId) } } });
  const items: any[] = listRes?.data || [];
  for (const it of items) {
    try {
      await (models as any).AppData.delete({ PK: it.PK, SK: it.SK });
    } catch (e) {
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
  ownerId?: string;
  name?: string;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<void> {
  const { demoId, ownerId, name, status = "DRAFT" } = params;
  const now = new Date().toISOString();
  const models = getPrivateModels();
  const res = await (models as any).AppData.create({
    PK: pkDemo(demoId),
    SK: "METADATA",
    ownerId,
    name,
    status,
    createdAt: now,
    updatedAt: now,
    statusUpdatedAt: now,
    GSI1PK: `OWNER#${ownerId}#DEMO`,
    GSI1SK: `STATUS#${status}#TS#${now}`,
    currentVersion: 1,
  });
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
  const models = getPrivateModels();
  const payload: Record<string, any> = {
    PK: pkDemo(demoId),
    SK: `STEP#${stepId}`,
    ownerId,
    s3Key,
    order,
    pageUrl,
    thumbnailS3Key,
  };
  if (Array.isArray(hotspots) && hotspots.length > 0) {
    try {
      payload.hotspots = JSON.stringify(hotspots);
    } catch (e) {}
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const res = await (models as any).AppData.create(payload);
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
  const models = getPrivateModels();
  const payload: Record<string, any> = {
    PK: pkDemo(demoId),
    SK: `STEP#${stepId}`,
  };
  if (Array.isArray(hotspots)) {
    try {
      payload.hotspots = JSON.stringify(hotspots);
    } catch (e) {}
  }
  const res = await (models as any).AppData.update(payload);
  console.log("[api/demos] updateDemoStepHotspots result", { stepId, res });
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `updateDemoStepHotspots failed for ${stepId}: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function listDemoItems(demoId: string) {
  try {
    try {
      await fetchAuthSession();
    } catch (e) {}
    try {
      try {
        const u = await getCurrentUser();
        console.debug("[api/demos] identity (username,userId):", (u as any)?.username, (u as any)?.userId);
      } catch (e) {
        console.debug("[api/demos] identity unavailable yet", e);
      }
      const models = getPrivateModels();
      let items: any[] = [];
      let nextToken: any = undefined;
      do {
        const res = await (models as any).AppData.list({ filter: { PK: { eq: pkDemo(demoId) } }, nextToken });
        console.debug("[api/demos] listDemoItems page (userPool):", {
          count: (res as any)?.data?.length ?? 0,
          hasNext: !!(res as any)?.nextToken,
        });
        const page = ((res as any)?.data ?? []).map((it: any) => {
          // Back-compat: expose itemSK like before the refactor
          if (it && it.itemSK === undefined && typeof it.SK === "string") {
            return { ...it, itemSK: it.SK };
          }
          return it;
        });
        items = items.concat(page);
        nextToken = (res as any)?.nextToken;
      } while (nextToken);
      if (Array.isArray(items) && items.length > 0) return items;
      try {
        const pubItems = await listPublicDemoItems(demoId);
        return pubItems;
      } catch (publicAfterEmptyErr) {
        return items;
      }
    } catch (userErr) {
      const pubItems = await listPublicDemoItems(demoId);
      return pubItems;
    }
  } catch (e) {
    throw e;
  }
}

// (moved getOwnerId above)

// -----------------
// TanStack Query hooks
// -----------------

export function useListMyDemos(
  status?: "DRAFT" | "PUBLISHED"
): UseQueryResult<
  Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>,
  Error
> {
  return useQuery({ queryKey: ["myDemos", status ?? "ALL"], queryFn: () => listMyDemos(status) });
}

export function useDemoItems(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({ queryKey: ["demoItems", demoId], queryFn: () => listDemoItems(demoId), enabled: !!demoId });
}

export function useLeadSubmissions(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ["leadSubmissions", demoId],
    queryFn: () => listLeadSubmissions(demoId),
    enabled: !!demoId,
  });
}

export function usePublicDemoItems(demoId: string): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: ["publicDemoItems", demoId],
    queryFn: () => listPublicDemoItems(demoId),
    enabled: !!demoId,
  });
}

export async function listMyDemos(
  status?: "DRAFT" | "PUBLISHED"
): Promise<Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>> {
  try {
    try {
      await fetchAuthSession();
    } catch (e) {}
    const ownerId = await getOwnerId();
    console.debug("[api/demos] listMyDemos ownerId:", ownerId, "status:", status ?? "(any)");
    if (!ownerId) {
      throw new Error("Not signed in. Please sign in to view your demos.");
    }
    const models = getPrivateModels();
    const filter: any = status
      ? { GSI1PK: { eq: `OWNER#${ownerId}#DEMO` }, GSI1SK: { beginsWith: `STATUS#${status}#` } }
      : { GSI1PK: { eq: `OWNER#${ownerId}#DEMO` } };
    let all: any[] = [];
    let nextToken: any = undefined;
    do {
      const res = await (models as any).AppData.list({ filter, nextToken });
      const page = (res as any)?.data ?? [];
      console.debug("[api/demos] listMyDemos page:", { count: page.length, hasNext: !!(res as any)?.nextToken });
      all = all.concat(page);
      nextToken = (res as any)?.nextToken;
    } while (nextToken);
    const mapped = all.map((it: any) => ({
      id: (it.PK || "").replace(/^DEMO#/, ""),
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
    const err = new Error(
      `Failed to list demos. ${e?.message || e?.toString?.() || "Unknown error"}. Is Amplify configured and user signed in?`
    );
    throw err;
  }
}
