import { useEffect, useRef } from "react";
import { presignedUrlCache } from "./usePresignedUrlCache";

export const buildCdnUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const isAbsoluteUrl = /^(https?:\/\/|\/\/)/i.test(raw);
  const isRelativePath = raw.startsWith("./");
  if (isAbsoluteUrl || isRelativePath) return raw;

  let base = import.meta.env.VITE_PUBLIC_ASSET_BASE_URL as string | undefined;
  // Normalize base to include protocol if missing
  if (base && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base ? `${String(base).replace(/\/$/, "")}/${String(raw).replace(/^\//, "")}` : undefined;
};

export function useImagePreloading(
  currentIndex: number,
  steps: Array<{ s3Key?: string; thumbnailS3Key?: string }>,
  lookahead: number = 3,
  s3Config?: { bucket?: string; region?: string }
) {
  const preloadCache = useRef(new Set<string>());
  const s3ConfigRef = useRef(s3Config);

  // Update ref when s3Config changes
  useEffect(() => {
    s3ConfigRef.current = s3Config;
  }, [s3Config]);

  useEffect(() => {
    if (currentIndex < 0) return;
    if (!Array.isArray(steps) || steps.length === 0) return;
    const start = currentIndex + 1;
    const end = Math.min(currentIndex + lookahead, steps.length - 1);
    if (start > end || start >= steps.length) return;

    const preloadImage = async (url: string, raw?: string) => {
      if (!url || preloadCache.current.has(url)) return;
      preloadCache.current.add(url);

      const img = new Image();

      // If CDN fails, try S3 fallback
      img.onerror = async () => {
        if (!raw) return;
        console.warn("[useImagePreloading] CDN failed for:", url, "- trying S3 fallback");

        // Try presigned URL first (using cache)
        try {
          const fallbackUrl = await presignedUrlCache.getUrl(raw);

          if (!preloadCache.current.has(fallbackUrl)) {
            preloadCache.current.add(fallbackUrl);
            const fallbackImg = new Image();
            fallbackImg.src = fallbackUrl;
            console.log("[useImagePreloading] Presigned URL pre-fetch started:", fallbackUrl);
          }
          return;
        } catch (e) {
          console.warn("[useImagePreloading] Presigned URL fallback failed:", e);
        }

        // Try direct S3 URL as last resort
        const config = s3ConfigRef.current;
        if (config?.bucket && config?.region) {
          try {
            const s3Url = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
            if (!preloadCache.current.has(s3Url)) {
              preloadCache.current.add(s3Url);
              const s3Img = new Image();
              s3Img.src = s3Url;
              console.log("[useImagePreloading] Direct S3 URL pre-fetch started:", s3Url);
            }
          } catch (e) {
            console.warn("[useImagePreloading] Direct S3 URL fallback failed:", e);
          }
        }
      };

      img.src = url;
    };

    for (let i = start; i <= end; i++) {
      const s = steps[i];
      const raw = s?.s3Key || s?.thumbnailS3Key;
      const url = buildCdnUrl(raw);
      if (url) preloadImage(url, raw);
    }
  }, [currentIndex, steps, lookahead]);
}
