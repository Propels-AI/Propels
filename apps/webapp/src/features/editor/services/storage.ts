import { getUrl } from "aws-amplify/storage";

/**
 * Resolve a screenshot URL from an s3Key-like value used by the editor.
 * Supports public/, protected/<identity>/, private/<identity>/, or a full URL.
 */
export async function resolveScreenshotUrl(raw: string | undefined): Promise<string | undefined> {
  if (!raw) return undefined;
  const isUrl = /^(https?:)?\/\//i.test(raw);
  if (isUrl) return raw;

  const s = String(raw);
  let access: "guest" | "protected" | "private" = "guest";
  let keyForStorage = s;
  if (s.startsWith("public/")) {
    access = "guest";
    keyForStorage = s.replace(/^public\//, "");
  } else if (s.startsWith("protected/")) {
    access = "protected";
    keyForStorage = s.replace(/^protected\/[^^/]+\//, "");
  } else if (s.startsWith("private/")) {
    access = "private";
    keyForStorage = s.replace(/^private\/[^^/]+\//, "");
  }
  try {
    const { url } = await getUrl({ key: keyForStorage, options: { accessLevel: access as any } } as any);
    return url.toString();
  } catch (err) {
    console.error("[storage] resolveScreenshotUrl failed", { raw, keyForStorage, access }, err);
    return undefined;
  }
}
