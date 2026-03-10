import { getUrl as storageGetUrl } from "aws-amplify/storage";

interface CachedUrl {
  url: string;
  expiresAt: number;
}

class PresignedUrlCache {
  private cache = new Map<string, CachedUrl>();
  private pending = new Map<string, Promise<string>>();

  async getUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    // Check if we have a valid cached URL
    const cached = this.cache.get(s3Key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    // Check if there's already a pending request for this key
    const pendingRequest = this.pending.get(s3Key);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new request
    const request = this.fetchPresignedUrl(s3Key, expiresIn);
    this.pending.set(s3Key, request);

    try {
      const url = await request;
      return url;
    } finally {
      this.pending.delete(s3Key);
    }
  }

  private async fetchPresignedUrl(s3Key: string, expiresIn: number): Promise<string> {
    const isPublicPrefixed = String(s3Key).startsWith("public/");
    const keyForStorage = isPublicPrefixed ? String(s3Key).replace(/^public\//, "") : String(s3Key);

    const { url: presignedUrl } = await storageGetUrl({
      key: keyForStorage,
      options: {
        accessLevel: "guest" as any,
        expiresIn,
      },
    });

    const urlString = presignedUrl.toString();

    // Cache with 90% of expiration time to be safe
    const expiresAt = Date.now() + expiresIn * 1000 * 0.9;
    this.cache.set(s3Key, { url: urlString, expiresAt });

    return urlString;
  }

  clear() {
    this.cache.clear();
    this.pending.clear();
  }
}

// Singleton instance
export const presignedUrlCache = new PresignedUrlCache();
