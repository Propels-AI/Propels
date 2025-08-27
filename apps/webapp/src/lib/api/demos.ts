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

export async function createPublicDemoMetadata(params: {
  demoId: string;
  ownerId?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
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
  const res = await models.PublicDemo.create(payload);
  if (!res?.data || (res as any)?.errors?.length) {
    throw new Error(
      `createPublicDemoMetadata failed: ${(res as any)?.errors?.map((e: any) => e?.message).join(", ") || "no data returned"}`
    );
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
  const res = await models.PublicDemo.list({ filter: { demoId: { eq: demoId } } });
  const items = res?.data ?? [];
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

export async function mirrorDemoToPublic(demoId: string): Promise<void> {
  console.log("[api/demos] mirrorDemoToPublic START", { demoId });
  const now = new Date().toISOString();
  const items = await listDemoItems(demoId);
  if (!Array.isArray(items) || items.length === 0) {
    console.warn("[api/demos] mirrorDemoToPublic: no private items found");
    return;
  }
  const meta = items.find((it: any) => it.itemSK === "METADATA");
  if (meta) {
    await createPublicDemoMetadata({
      demoId,
      name: meta.name,
      createdAt: meta.createdAt,
      updatedAt: now,
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

export async function listMyDemos(
  status?: "DRAFT" | "PUBLISHED"
): Promise<Array<{ id: string; name?: string; status?: string; createdAt?: string; updatedAt?: string }>> {
  try {
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
    const res = await models.Demo.list({
      filter,
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
