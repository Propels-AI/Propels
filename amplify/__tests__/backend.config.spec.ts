/**
 * Framework: Vitest
 * Purpose: Validate that amplify/backend.test.ts correctly registers Amplify backend
 * by invoking defineBackend with the expected resources: auth, data, storage.
 *
 * We mock:
 *  - @aws-amplify/backend defineBackend to observe invocation and capture args
 *  - ./auth/resource, ./data/resource, ./storage/resource to provide stable sentinels
 *
 * Tests:
 *  - Calls defineBackend exactly once on module import
 *  - Passes through the exact resource objects (identity) for auth, data, storage
 *  - Proper error propagation if defineBackend throws (import should fail)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Sentinel resource objects to assert identity
const AUTH_SENTINEL = { kind: "auth", tag: "AUTH_SENTINEL" } as const;
const DATA_SENTINEL = { kind: "data", tag: "DATA_SENTINEL" } as const;
const STORAGE_SENTINEL = { kind: "storage", tag: "STORAGE_SENTINEL" } as const;

// Mock the resource modules BEFORE importing the SUT
vi.mock("../auth/resource", () => ({
  auth: AUTH_SENTINEL,
}));
vi.mock("../data/resource", () => ({
  data: DATA_SENTINEL,
}));
vi.mock("../storage/resource", () => ({
  storage: STORAGE_SENTINEL,
}));

// Mock @aws-amplify/backend and capture defineBackend
const defineBackendSpy = vi.fn();
vi.mock("@aws-amplify/backend", () => ({
  defineBackend: defineBackendSpy,
}));

// Helper to import SUT in isolated module context
async function importSut() {
  // Use dynamic import to honor mocks and avoid module caching across tests
  return await import("../backend.test");
}

describe("amplify/backend.test.ts - Amplify backend registration", () => {
  beforeEach(() => {
    vi.resetModules();
    defineBackendSpy.mockReset();
  });

  it("calls defineBackend exactly once on import with required resources", async () => {
    await importSut();

    expect(defineBackendSpy).toHaveBeenCalledTimes(1);
    const call = defineBackendSpy.mock.calls[0] as [Record<string, unknown>];

    expect(call).toBeTruthy();
    const [arg] = call;
    // Object should have the shape { auth, data, storage }
    expect(arg).toMatchObject({
      auth: AUTH_SENTINEL,
      data: DATA_SENTINEL,
      storage: STORAGE_SENTINEL,
    });

    // Identity checks to ensure the exact objects are passed through
    expect(arg.auth).toBe(AUTH_SENTINEL);
    expect(arg.data).toBe(DATA_SENTINEL);
    expect(arg.storage).toBe(STORAGE_SENTINEL);
  });

  it("propagates errors thrown by defineBackend during import", async () => {
    const error = new Error("defineBackend failure");
    defineBackendSpy.mockImplementationOnce(() => {
      throw error;
    });

    await expect(importSut()).rejects.toThrow(error);
    expect(defineBackendSpy).toHaveBeenCalledTimes(1);
  });

  it("does not alter resource objects prior to calling defineBackend", async () => {
    await importSut();
    const [args] = defineBackendSpy.mock.calls[0] as [Record<string, unknown>];
    // Sanity: ensure no unexpected keys are introduced
    expect(Object.keys(args).sort()).toEqual(["auth", "data", "storage"]);
  });
});