import { useEffect, useState } from "react";
import { presignedUrlCache } from "@/hooks/usePresignedUrlCache";

export function useImageResolver(
  rawKeyOrUrl: string | undefined,
  directUrl?: string,
  computeAspect: boolean = false,
  opts?: { bucket?: string; region?: string }
) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [naturalAspect, setNaturalAspect] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryStorageFallback = async () => {
      const raw = rawKeyOrUrl;
      if (!raw) return;
      // Try Storage.getUrl for public/ keys (using cache)
      try {
        const u = await presignedUrlCache.getUrl(raw);
        if (!cancelled) {
          setResolvedSrc(u);
          if (computeAspect) {
            try {
              const img = new Image();
              img.onload = () => {
                if (cancelled) return;
                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;
                if (w > 0 && h > 0) {
                  console.log("[useImageResolver] Presigned URL loaded successfully, size:", w, "x", h);
                  setNaturalAspect(`${w} / ${h}`);
                  setNaturalSize({ w, h });
                }
              };
              img.src = u;
            } catch {}
          }
        }
        return;
      } catch {}
      // Fallback to direct S3 URL when provided by caller
      try {
        const bucket = opts?.bucket;
        const region = opts?.region;
        if (bucket && region) {
          const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
          if (!cancelled) {
            setResolvedSrc(s3Url);
            if (computeAspect) {
              try {
                const img = new Image();
                img.onload = () => {
                  if (cancelled) return;
                  const w = img.naturalWidth || img.width || 0;
                  const h = img.naturalHeight || img.height || 0;
                  if (w > 0 && h > 0) {
                    setNaturalAspect(`${w} / ${h}`);
                    setNaturalSize({ w, h });
                  }
                };
                img.src = s3Url;
              } catch {}
            }
          }
          return;
        }
      } catch {}
      // Last resort: use raw
      if (!cancelled) {
        setResolvedSrc(raw as string);
        if (computeAspect) {
          try {
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if (w > 0 && h > 0) {
                setNaturalAspect(`${w} / ${h}`);
                setNaturalSize({ w, h });
              }
            };
            img.src = raw as string;
          } catch {}
        }
      }
    };

    async function resolve() {
      const raw = rawKeyOrUrl;
      const hasDirect = typeof directUrl === "string" && directUrl.length > 0;
      if (!raw) {
        setResolvedSrc(undefined);
        setNaturalAspect(null);
        setNaturalSize(null);
        return;
      }
      if (hasDirect) {
        // Start with CDN URL
        setResolvedSrc(directUrl);
        if (directUrl) {
          try {
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              if (!computeAspect) return;
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if (w > 0 && h > 0) {
                setNaturalAspect(`${w} / ${h}`);
                setNaturalSize({ w, h });
              }
            };
            img.onerror = () => {
              // CDN failed, try fallback chain even when not computing aspect
              if (cancelled) return;
              console.warn("[useImageResolver] CDN load failed, attempting fallback for:", directUrl);
              console.log("[useImageResolver] computeAspect:", computeAspect, "rawKeyOrUrl:", rawKeyOrUrl);
              tryStorageFallback();
            };
            img.src = directUrl;
          } catch {}
        }
        return;
      }
      // If no CDN URL, try fallback immediately
      await tryStorageFallback();
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [rawKeyOrUrl, directUrl, computeAspect]);

  return { resolvedSrc, naturalAspect, naturalSize } as const;
}
