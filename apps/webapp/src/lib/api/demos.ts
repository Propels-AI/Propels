import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";

function getModels() {
  console.debug("[api/demos] creating data client via generateClient()...");
  const client = generateClient();
  const models: any = (client as any).models;
  if (!models) {
    throw new Error("Amplify Data models unavailable after generateClient(). Check Amplify.configure outputs.data");
  }
  return models;
}

// Rename demo: update METADATA record's name and updatedAt
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

// Set status (publish/unpublish) on METADATA and bump statusUpdatedAt, updatedAt
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
}

// Delete demo: delete all items with this demoId
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
  // Absolute position (legacy). Optional to allow normalized-only hotspots in editor.
  x?: number;
  y?: number;
  width: number;
  height: number;
  // Preferred normalized coordinates within the image (0..1)
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
  // AWSJSON often expects a JSON string. Also, strip undefined fields.
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
  // Remove keys with undefined to avoid invalid variable errors
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const res = await models.Demo.create(payload);
  console.log("[api/demos] createDemoStep result", { stepId, res });
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createDemoStep failed for ${stepId}: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
  }
}

export async function listDemoItems(demoId: string) {
  console.debug("[api/demos] listDemoItems ->", { demoId });
  try {
    const models = getModels();
    const res = await models.Demo.list({
      filter: { demoId: { eq: demoId } },
    });
    console.debug("[api/demos] listDemoItems res:", res);
    return res.data;
  } catch (e) {
    console.error("[api/demos] listDemoItems error", e);
    throw e;
  }
}

export async function getOwnerId(): Promise<string | undefined> {
  try {
    const user = await getCurrentUser();
    return user?.userId;
  } catch {
    return undefined;
  }
}

export async function listMyDemos(): Promise<
  Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>
> {
  try {
    const ownerId = await getOwnerId();
    console.debug("[api/demos] listMyDemos ownerId:", ownerId);
    if (!ownerId) {
      throw new Error("Not signed in. Please sign in to view your demos.");
    }
    const models = getModels();
    const res = await models.Demo.list({
      filter: {
        itemSK: { eq: "METADATA" },
        ownerId: { eq: ownerId },
      },
    });
    console.debug("[api/demos] listMyDemos res:", res);
    const items = res?.data ?? [];
    return items.map((it: any) => ({
      id: it.demoId,
      name: it.name,
      status: it.status,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));
  } catch (e: any) {
    console.error("[api/demos] listMyDemos error:", e);
    const err = new Error(
      `Failed to list demos. ${e?.message || e?.toString?.() || "Unknown error"}. Is Amplify configured and user signed in?`
    );
    throw err;
  }
}
