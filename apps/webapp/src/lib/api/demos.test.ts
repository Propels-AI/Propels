import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const authHoisted = vi.hoisted(() => ({
  fetchAuthSession: vi.fn().mockResolvedValue({}),
  getCurrentUser: vi.fn().mockResolvedValue({ username: "alice", userId: "sub-123" }),
}));

const dataHoisted = vi.hoisted(() => ({
  appDataListImpl: undefined as undefined | ((args: any) => Promise<any>),
  appDataGetImpl: undefined as undefined | ((args: any) => Promise<any>),
  publicListImpl: undefined as undefined | ((args: any) => Promise<any>),
  publicGetImpl: undefined as undefined | ((args: any) => Promise<any>),
}));

vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: authHoisted.fetchAuthSession,
  getCurrentUser: authHoisted.getCurrentUser,
}));

vi.mock("aws-amplify/data", () => ({
  generateClient: vi.fn((_opts?: any) => ({
    models: {
      AppData: {
        list: (args: any) => dataHoisted.appDataListImpl?.(args) ?? Promise.resolve({ data: [], nextToken: undefined }),
        get: (args: any) => dataHoisted.appDataGetImpl?.(args) ?? Promise.resolve({ data: undefined }),
      },
      PublicMirror: {
        list: (args: any) => dataHoisted.publicListImpl?.(args) ?? Promise.resolve({ data: [], nextToken: undefined }),
        get: (args: any) => dataHoisted.publicGetImpl?.(args) ?? Promise.resolve({ data: undefined }),
      },
    },
  })),
}));

// Module under test must be imported AFTER mocks
import * as api from "@/lib/api/demos";

beforeEach(() => {
  vi.clearAllMocks();
  dataHoisted.appDataListImpl = undefined;
  dataHoisted.appDataGetImpl = undefined;
  dataHoisted.publicListImpl = undefined;
  dataHoisted.publicGetImpl = undefined;
});

function makeItem(overrides: Partial<any> = {}) {
  return {
    demoId: overrides.demoId ?? "demo-1",
    PK: overrides.PK ?? `DEMO#${overrides.demoId ?? "demo-1"}`,
    itemSK: overrides.itemSK ?? "METADATA",
    name: overrides.name ?? "Demo A",
    status: overrides.status ?? "DRAFT",
    order: overrides.order,
    createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2025-01-02T00:00:00.000Z",
    s3Key: overrides.s3Key,
    pageUrl: overrides.pageUrl,
    hotspots: overrides.hotspots,
  };
}

describe("listMyDemos", () => {
  it("paginates across nextToken and sorts by updatedAt desc", async () => {
    const pages = [
      { data: [], nextToken: "t2" },
      {
        data: [
          makeItem({ itemSK: "METADATA", demoId: "d1", name: "Older", updatedAt: "2025-01-01T01:00:00.000Z" }),
          makeItem({ itemSK: "METADATA", demoId: "d2", name: "Newer", updatedAt: "2025-01-03T00:00:00.000Z" }),
        ],
        nextToken: undefined,
      },
    ];
    let call = 0;
    dataHoisted.appDataListImpl = async (_args) => pages[call++];

    const result = await api.listMyDemos();
    expect(result.map((r) => r.id)).toEqual(["d2", "d1"]);
  });
});

describe("listDemoItems", () => {
  it("paginates when first page is empty and returns items from later page", async () => {
    const meta = makeItem({ itemSK: "METADATA", demoId: "demo-2" });
    const step1 = makeItem({ itemSK: "STEP#s1", demoId: "demo-2", order: 1, s3Key: "public/img1.png" });
    const pages = [
      { data: [], nextToken: "t2" },
      { data: [meta, step1], nextToken: undefined },
    ];
    let call = 0;
    dataHoisted.appDataListImpl = async (_args) => pages[call++];

    const result = await api.listDemoItems("demo-2");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result.find((it: any) => it.itemSK === "METADATA")).toBeTruthy();
    expect(result.find((it: any) => it.itemSK === "STEP#s1")).toBeTruthy();
  });

  it("falls back to public mirror when private list is empty", async () => {
    const demoId = "demo-3";
    dataHoisted.appDataListImpl = async () => ({ data: [], nextToken: undefined });
    dataHoisted.publicListImpl = async (args) => {
      if (args?.filter?.PK?.eq === `PUB#${demoId}`) {
        return {
          data: [
            makeItem({ demoId, itemSK: "METADATA", name: "Fallback Demo" }),
            makeItem({ demoId, itemSK: "STEP#s1", order: 1, s3Key: "public/one.png" }),
            makeItem({ demoId, itemSK: "STEP#s2", order: 2, s3Key: "public/two.png" }),
          ],
          nextToken: undefined,
        } as any;
      }
      return { data: [], nextToken: undefined } as any;
    };

    const result = await api.listDemoItems(demoId);
    expect(result[0]?.itemSK).toBe("METADATA");
    const steps = result.filter((it: any) => String(it.itemSK).startsWith("STEP#"));
    expect(steps.length).toBe(2);
  });
});
