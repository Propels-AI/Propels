import { useEffect, useRef } from "react";

export const buildCdnUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const isUrl = /^(https?:)?\/\//i.test(raw);
  if (isUrl) return raw;
  const base = import.meta.env.VITE_PUBLIC_ASSET_BASE_URL as string | undefined;
  return base ? `${String(base).replace(/\/$/, "")}/${String(raw).replace(/^\//, "")}` : undefined;
};

export function useImagePreloading(
  currentIndex: number,
  steps: Array<{ s3Key?: string; thumbnailS3Key?: string }>,
  lookahead: number = 3
) {
  const preloadCache = useRef(new Set<string>());

  const preloadImage = (url: string) => {
    if (!url || preloadCache.current.has(url)) return;
    preloadCache.current.add(url);
    const img = new Image();
    img.src = url;
  };

  useEffect(() => {
    if (currentIndex < 0) return;
    if (!Array.isArray(steps) || steps.length === 0) return;
    const start = currentIndex + 1;
    const end = Math.min(currentIndex + lookahead, steps.length - 1);
    if (start > end || start >= steps.length) return;
    for (let i = start; i <= end; i++) {
      const s = steps[i];
      const raw = s?.s3Key || s?.thumbnailS3Key;
      const url = buildCdnUrl(raw);
      if (url) preloadImage(url);
    }
  }, [currentIndex, steps, lookahead]);
}
