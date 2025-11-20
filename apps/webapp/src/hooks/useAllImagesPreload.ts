import { useEffect, useState } from "react";
import { buildCdnUrl } from "./useImagePreloading";
import { presignedUrlCache } from "./usePresignedUrlCache";

interface PreloadOptions {
  bucket?: string;
  region?: string;
}

export function useAllImagesPreload(
  steps: Array<{ s3Key?: string; thumbnailS3Key?: string }>,
  options?: PreloadOptions
) {
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    if (!steps || steps.length === 0) {
      setAllLoaded(true);
      setLoadProgress(100);
      return;
    }

    let cancelled = false;
    const loadedCount = { current: 0 };

    const preloadAllImages = async () => {
      const imagePromises = steps.map(async (step, index) => {
        const raw = step?.s3Key || step?.thumbnailS3Key;
        if (!raw) {
          loadedCount.current++;
          if (!cancelled) {
            setLoadProgress(Math.round((loadedCount.current / steps.length) * 100));
          }
          return;
        }

        // Try CDN first
        const cdnUrl = buildCdnUrl(raw);
        if (cdnUrl) {
          try {
            await loadImage(cdnUrl);
            loadedCount.current++;
            if (!cancelled) {
              setLoadProgress(Math.round((loadedCount.current / steps.length) * 100));
            }
            return;
          } catch (e) {
            console.warn(`[useAllImagesPreload] CDN failed for step ${index}, trying S3 fallback`);
          }
        }

        // Fallback to S3 presigned URL
        try {
          const presignedUrl = await presignedUrlCache.getUrl(raw);
          await loadImage(presignedUrl);
          loadedCount.current++;
          if (!cancelled) {
            setLoadProgress(Math.round((loadedCount.current / steps.length) * 100));
          }
          return;
        } catch (e) {
          console.warn(`[useAllImagesPreload] Presigned URL failed for step ${index}`);
        }

        // Last resort: direct S3 URL
        if (options?.bucket && options?.region) {
          try {
            const s3Url = `https://${options.bucket}.s3.${options.region}.amazonaws.com/${String(raw).replace(/^\//, "")}`;
            await loadImage(s3Url);
            loadedCount.current++;
            if (!cancelled) {
              setLoadProgress(Math.round((loadedCount.current / steps.length) * 100));
            }
            return;
          } catch (e) {
            console.error(`[useAllImagesPreload] All methods failed for step ${index}:`, raw);
            // Still count as "loaded" to not block forever
            loadedCount.current++;
            if (!cancelled) {
              setLoadProgress(Math.round((loadedCount.current / steps.length) * 100));
            }
          }
        }
      });

      await Promise.all(imagePromises);

      if (!cancelled) {
        setAllLoaded(true);
        setLoadProgress(100);
      }
    };

    preloadAllImages();

    return () => {
      cancelled = true;
    };
  }, [steps, options?.bucket, options?.region]);

  return { allLoaded, loadProgress };
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}
