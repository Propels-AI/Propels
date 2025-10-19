interface CustomScreenshot {
  id: string;
  screenshotBlob: Blob;
  timestamp: number;
  fileName?: string;
  order: number;
}

class CustomScreenshotStorage {
  private dbName = "PropelsEditorDB";
  private storeName = "customScreenshots";
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async saveScreenshot(id: string, blob: Blob, fileName?: string, order?: number): Promise<void> {
    if (!this.db) await this.init();

    const screenshot: CustomScreenshot = {
      id,
      screenshotBlob: blob,
      timestamp: Date.now(),
      fileName,
      order: order ?? 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(screenshot);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getScreenshot(id: string): Promise<Blob | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as CustomScreenshot | undefined;
        resolve(result?.screenshotBlob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllScreenshots(): Promise<Map<string, Blob>> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const screenshots = request.result as CustomScreenshot[];
        const map = new Map<string, Blob>();
        screenshots.forEach((screenshot) => {
          map.set(screenshot.id, screenshot.screenshotBlob);
        });
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllScreenshotsWithOrder(): Promise<Array<{ id: string; blob: Blob; order: number }>> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const screenshots = request.result as CustomScreenshot[];
        // Sort by order
        const sorted = screenshots
          .map((s) => ({ id: s.id, blob: s.screenshotBlob, order: s.order }))
          .sort((a, b) => a.order - b.order);
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateOrder(updates: Array<{ id: string; order: number }>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const promises = updates.map(({ id, order }) => {
        return new Promise<void>((res, rej) => {
          const getRequest = store.get(id);
          getRequest.onsuccess = () => {
            const screenshot = getRequest.result as CustomScreenshot;
            if (screenshot) {
              screenshot.order = order;
              const putRequest = store.put(screenshot);
              putRequest.onsuccess = () => res();
              putRequest.onerror = () => rej(putRequest.error);
            } else {
              res();
            }
          };
          getRequest.onerror = () => rej(getRequest.error);
        });
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch((error) => reject(error));
    });
  }

  async deleteScreenshot(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const customScreenshotStorage = new CustomScreenshotStorage();
