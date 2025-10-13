import { uploadStepImage } from "../services/s3Service";
import {
  createDemoMetadata,
  createDemoStep,
  getOwnerId,
  Hotspot,
  updateDemoLeadConfig,
} from "../api/demos";
import { fetchAuthSession } from "aws-amplify/auth";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(header || "");
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const bytes = atob(base64 || "");
  const len = bytes.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export type EditedDraft = {
  draftId: string;
  createdAt: string;
  name?: string;
  steps: Array<{ id: string; pageUrl: string; order: number; zoom?: number }>;
  hotspotsByStep: Record<string, Hotspot[]>;
  // Optional lead-capture metadata
  leadStepIndex?: number | null;
  leadConfig?: any;
};

export async function syncAnonymousDemo(options?: {
  inlineDraft?: EditedDraft; // if provided, skips localStorage read
  extensionId?: string; // override for tests
}): Promise<{ demoId: string; stepCount: number }> {
  const extId =
    options?.extensionId || (window as any)?.__EXT_ID__ || (import.meta as any).env?.VITE_CHROME_EXTENSION_ID || "";

  // 1) Load draft (inline or from localStorage)
  let draft: EditedDraft | undefined = options?.inlineDraft;
  let draftId: string | undefined;
  if (!draft) {
    console.log("[sync] No inline draft provided; loading from localStorage...");
    const pendingDraftId = localStorage.getItem("pendingDraftId") || undefined;
    if (!pendingDraftId) throw new Error("No pending draft id found");
    const raw = localStorage.getItem(`demoEditedDraft:${pendingDraftId}`);
    if (!raw) throw new Error("Edited draft not found in localStorage");
    draft = JSON.parse(raw);
    draftId = pendingDraftId;
  } else {
    console.debug("[sync] Using inline draft", {
      draftId: options?.inlineDraft?.draftId,
      steps: options?.inlineDraft?.steps?.length,
    });
    draftId = draft.draftId;
  }

  // 2) Fetch captures from extension
  if (!(typeof chrome !== "undefined" && chrome.runtime && extId)) {
    throw new Error("Chrome extension not available or extensionId missing");
  }
  console.log("[sync] Requesting captures from extension", { extIdPresent: !!extId });
  const response = await chrome.runtime.sendMessage(extId, { type: "GET_CAPTURE_SESSION" });
  if (!response?.success || !Array.isArray(response.data)) throw new Error("Failed to retrieve capture session");
  const captures: Array<any> = response.data;
  console.log("[sync] Retrieved captures count:", captures.length);
  if (captures.length === 0) {
    throw new Error("No captures returned, aborting demo creation");
  }
  const captureMap = new Map<string, any>();
  captures.forEach((c) => captureMap.set(String(c.id), c));

  // 3) Create demo and upload steps
  const demoId: string = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`;
  const dataOwnerId = await getOwnerId();
  if (!dataOwnerId) {
    throw new Error("Not signed in. Please sign in or sign up to save your demo.");
  }

  // Storage policy expects Identity Pool identityId in the S3 key prefix (not the user pool sub)
  const session = await fetchAuthSession();
  const identityId = session?.identityId; // e.g., ap-southeast-1:97bcc032-...
  const storageOwnerId = identityId?.includes(":") ? identityId.split(":").pop() : identityId; // use GUID only
  console.log("[sync] Auth context", { dataOwnerId, identityId, storageOwnerId });
  if (!storageOwnerId) {
    throw new Error("Missing identityId for storage. Please retry after signing in.");
  }

  console.log("[sync] Creating demo metadata", { demoId, ownerId: dataOwnerId, name: draft?.name });
  await createDemoMetadata({ demoId, ownerId: dataOwnerId, name: draft?.name, status: "DRAFT" });
  // Persist private lead config if present
  try {
    if (draft && typeof draft.leadStepIndex !== "undefined") {
      await updateDemoLeadConfig({ demoId, leadStepIndex: draft.leadStepIndex ?? null, leadConfig: draft.leadConfig });
    }
  } catch (e) {
    console.warn("[sync] updateDemoLeadConfig failed (non-fatal)", e);
  }

  let created = 0;
  for (const s of draft!.steps) {
    try {
      const cap = captureMap.get(String(s.id));
      if (!cap?.screenshotDataUrl) {
        console.warn("[sync] Missing screenshot for step; skipping", s);
        continue;
      }
      const blob = dataUrlToBlob(cap.screenshotDataUrl);
      const { s3Key, publicUrl } = await uploadStepImage({
        ownerId: storageOwnerId!,
        demoId,
        stepId: s.id,
        file: blob,
        contentType: blob.type,
      });
      console.log("[sync] Uploaded step image", { stepId: s.id, s3Key, publicUrl });

      const hotspots = draft!.hotspotsByStep[s.id] || [];
      await createDemoStep({
        demoId,
        stepId: s.id,
        s3Key,
        hotspots,
        order: s.order,
        pageUrl: s.pageUrl,
        ownerId: dataOwnerId,
        zoom: s.zoom, // Include zoom data when creating the step
      });
      console.log("[sync] Created step record", { stepId: s.id, order: s.order });
      created++;
    } catch (err) {
      console.error("[sync] Failed to upload/create step", { stepId: s.id }, err);
    }
  }

  // 4) Cleanup extension and local draft
  try {
    await chrome.runtime.sendMessage(extId, { type: "CLEAR_CAPTURE_SESSION" });
  } catch {}

  if (!options?.inlineDraft && draftId) {
    localStorage.removeItem(`demoEditedDraft:${draftId}`);
    localStorage.removeItem("pendingDraftId");
  }

  console.log("[sync] Completed", { demoId, stepCount: created });
  if (created === 0) {
    console.warn("[sync] No steps were created. Check earlier logs for upload or create errors.");
  }
  return { demoId, stepCount: created };
}
