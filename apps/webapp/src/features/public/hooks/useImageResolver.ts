import { useEffect, useState } from "react";
import { getUrl as storageGetUrl } from "aws-amplify/storage";

export function useImageResolver(
  rawKeyOrUrl: string | undefined,
  directUrl?: string,
  computeAspect: boolean = false,
  opts?: { bucket?: string; region?: string }
) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [naturalAspect, setNaturalAspect] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryStorageFallback = async () => {
      const raw = rawKeyOrUrl;
      if (!raw) return;
      // Try Storage.getUrl for public/ keys
      try {
        const isPublicPrefixed = String(raw).startsWith("public/");
        const keyForStorage = isPublicPrefixed ? String(raw).replace(/^public\//, "") : String(raw);
        const { url } = await storageGetUrl({ key: keyForStorage, options: { accessLevel: "guest" as any } });
        if (!cancelled) {
          const u = url.toString();
          setResolvedSrc(u);
          if (computeAspect) {
            try {
              const img = new Image();
              img.onload = () => {
                if (cancelled) return;
                const w = img.naturalWidth || img.width || 0;
                const h = img.naturalHeight || img.height || 0;
                if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
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
                  if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
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
              if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
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
        return;
      }
      if (hasDirect) {
        setResolvedSrc(directUrl);
        if (computeAspect && directUrl) {
          try {
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              const w = img.naturalWidth || img.width || 0;
              const h = img.naturalHeight || img.height || 0;
              if (w > 0 && h > 0) setNaturalAspect(`${w} / ${h}`);
            };
            img.onerror = () => {
              // CDN failed, try fallback chain
              if (cancelled) return;
              console.warn("[useImageResolver] CDN load failed, attempting fallback for:", directUrl);
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

  return { resolvedSrc, naturalAspect } as const;
}
