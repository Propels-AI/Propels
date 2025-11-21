import { uploadStepImage } from "../services/s3Service";
import { createDemoMetadata, createDemoStep, getOwnerId, Hotspot, updateDemoLeadConfig } from "../api/demos";
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
  steps: Array<{
    id: string;
    pageUrl: string;
    order: number;
    zoom?: number;
    isCustomUpload?: boolean;
    isLeadCapture?: boolean;
  }>;
  hotspotsByStep: Record<string, Hotspot[]>;
  // Optional lead-capture metadata
  leadStepIndex?: number | null;
  leadConfig?: any;
};

export async function syncAnonymousDemo(options?: {
  inlineDraft?: EditedDraft; // if provided, skips localStorage read
  extensionId?: string; // override for tests
  customScreenshots?: Map<string, Blob>; // custom uploaded screenshots
}): Promise<{ demoId: string; stepCount: number }> {
  const extId =
    options?.extensionId || (window as any)?.__EXT_ID__ || (import.meta as any).env?.VITE_CHROME_EXTENSION_ID || "";

  // 1) Load draft (inline or from localStorage)
  let draft: EditedDraft | undefined = options?.inlineDraft;
  let draftId: string | undefined;
  if (!draft) {
    const pendingDraftId = localStorage.getItem("pendingDraftId") || undefined;
    if (!pendingDraftId) throw new Error("No pending draft id found");
    const raw = localStorage.getItem(`demoEditedDraft:${pendingDraftId}`);
    if (!raw) throw new Error("Edited draft not found in localStorage");
    draft = JSON.parse(raw);
    draftId = pendingDraftId;
  } else {
    draftId = draft.draftId;
  }

  // 2) Fetch captures from extension (optional if we have custom screenshots)
  let captureMap = new Map<string, any>();
  const hasCustomScreenshots = options?.customScreenshots && options.customScreenshots.size > 0;

  if (typeof chrome !== "undefined" && chrome.runtime && extId) {
    try {
      const response = await chrome.runtime.sendMessage(extId, { type: "GET_CAPTURE_SESSION" });
      if (response?.success && Array.isArray(response.data)) {
        const captures: Array<any> = response.data;
        captures.forEach((c) => captureMap.set(String(c.id), c));
      }
    } catch (e) {
      console.warn("[sync] Failed to retrieve extension captures:", e);
    }
  }

  // Check if we have any data to save (either extension captures or custom screenshots)
  const hasExtensionCaptures = captureMap.size > 0;
  const hasProvidedBlobs = hasCustomScreenshots;

  if (!hasExtensionCaptures && !hasProvidedBlobs) {
    console.warn("[sync] No captures or screenshots found", {
      captureMapSize: captureMap.size,
      customScreenshotsSize: options?.customScreenshots?.size || 0,
      draftStepsCount: draft?.steps?.length || 0,
    });
    // Don't throw error if we have steps in draft - we'll try to process them
    if (!draft?.steps || draft.steps.length === 0) {
      throw new Error("No captures or custom screenshots to save");
    }
  }

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
  if (!storageOwnerId) {
    throw new Error("Missing identityId for storage. Please retry after signing in.");
  }

  await createDemoMetadata({ demoId, ownerId: dataOwnerId, name: draft?.name, status: "DRAFT" });

  let created = 0;
  const customScreenshots = options?.customScreenshots || new Map<string, Blob>();

  // Track which steps actually get saved so we can adjust leadStepIndex
  const savedStepIndices: number[] = [];
  const skippedStepIndices: number[] = [];

  for (let i = 0; i < draft!.steps.length; i++) {
    const s = draft!.steps[i];
    try {
      // Skip lead capture steps - they don't have screenshots and are handled separately via leadConfig
      if (s.isLeadCapture) {
        continue;
      }

      let blob: Blob | undefined;

      // First, try to get blob from passed customScreenshots (includes both extension and custom uploads)
      blob = customScreenshots.get(s.id);

      if (!blob) {
        // Fallback: try to get from extension capture map if blob wasn't provided
        const cap = captureMap.get(String(s.id));
        if (cap?.screenshotDataUrl) {
          blob = dataUrlToBlob(cap.screenshotDataUrl);
        }
      }

      if (!blob) {
        skippedStepIndices.push(i);
        continue;
      }
      const { s3Key, publicUrl } = await uploadStepImage({
        ownerId: storageOwnerId!,
        demoId,
        stepId: s.id,
        file: blob,
        contentType: blob.type,
      });

      const hotspots = draft!.hotspotsByStep[s.id] || [];
      await createDemoStep({
        demoId,
        stepId: s.id,
        s3Key,
        hotspots,
        order: created, // Use sequential order based on actually saved steps
        pageUrl: s.pageUrl,
        ownerId: dataOwnerId,
        zoom: s.zoom, // Include zoom data when creating the step
      });
      savedStepIndices.push(i);
      created++;
    } catch (err) {
      console.error("[sync] Failed to upload/create step", { stepId: s.id, stepIndex: i }, err);
      skippedStepIndices.push(i);
    }
  }

  // Adjust leadStepIndex to account for skipped steps
  if (draft && typeof draft.leadStepIndex === "number") {
    const originalLeadIndex = draft.leadStepIndex;
    // Count how many steps before the lead step were skipped
    const skippedBeforeLead = skippedStepIndices.filter((idx) => idx < originalLeadIndex).length;
    const adjustedLeadIndex = originalLeadIndex - skippedBeforeLead;

    // Update the draft with adjusted index before persisting
    draft.leadStepIndex = adjustedLeadIndex;
  }

  // Persist private lead config with adjusted leadStepIndex
  try {
    if (draft && typeof draft.leadStepIndex !== "undefined") {
      await updateDemoLeadConfig({ demoId, leadStepIndex: draft.leadStepIndex ?? null, leadConfig: draft.leadConfig });
    }
  } catch (e) {
    console.warn("[sync] updateDemoLeadConfig failed (non-fatal)", e);
  }

  if (created === 0) {
    console.error("[sync] No steps were created. Check earlier logs for upload or create errors.");
    throw new Error(
      "Failed to save demo: No steps could be uploaded. Please check your internet connection and try again."
    );
  }

  if (skippedStepIndices.length > 0) {
    console.warn(
      `[sync] Warning: ${skippedStepIndices.length} step(s) were skipped due to missing screenshot data. Saved ${created} of ${draft!.steps.filter((s) => !s.isLeadCapture).length} steps.`
    );
  }

  // 4) Cleanup extension and local draft AFTER successful save
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && extId) {
      await chrome.runtime.sendMessage(extId, { type: "CLEAR_CAPTURE_SESSION" });
    }
  } catch (cleanupErr) {
    console.warn("[sync] Failed to clear extension session (non-fatal)", cleanupErr);
  }

  if (!options?.inlineDraft && draftId) {
    try {
      localStorage.removeItem(`demoEditedDraft:${draftId}`);
      localStorage.removeItem("pendingDraftId");
    } catch (lsErr) {
      console.warn("[sync] Failed to clear localStorage draft (non-fatal)", lsErr);
    }
  }

  return { demoId, stepCount: created };
}
