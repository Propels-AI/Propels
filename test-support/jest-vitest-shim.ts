// Simple shim to map jest.* APIs to Vitest when using Vitest as the test runner.
// In Vitest setupFiles or globalSetup, you can import this shim to define global jest.
import { vi, expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const jestLike = {
  fn: vi.fn,
  spyOn: vi.spyOn,
  mock: vi.mock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
};

(globalThis as any).jest = { ...jestLike };
export { vi, expect, describe, it, beforeAll, afterAll, beforeEach, afterEach };