import { uploadData, getUrl } from "aws-amplify/storage";

export async function uploadStepImage(params: {
  ownerId: string;
  demoId: string;
  stepId: string;
  file: Blob | File;
  contentType?: string;
}): Promise<{ s3Key: string; publicUrl?: string }> {
  const { ownerId, demoId, stepId, file, contentType } = params;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = inferExtension(contentType || (file as any).type);
  const filename = `${unique}${ext ? "." + ext : ""}`;
  // Path must include userId segment to satisfy policy: public/demos/{userId}/*
  const path = `public/demos/${ownerId}/${demoId}/${stepId}/${filename}`;

  await uploadData({
    data: file,
    path,
    options: { contentType: contentType || (file as any).type },
  }).result;

  let publicUrl: string | undefined;
  try {
    const { url } = await getUrl({ path });
    publicUrl = url.toString();
  } catch (_) {}

  return { s3Key: path, publicUrl };
}

function inferExtension(mime?: string): string | undefined {
  if (!mime) return undefined;
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return undefined;
  }
}
