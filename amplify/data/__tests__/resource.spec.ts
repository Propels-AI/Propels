/**
 * Tests for amplify/data/resource.test.ts schema and data definition.
 *
 * Framework: Jest (with ts-jest) or Vitest (jest-compatible APIs).
 * If using Vitest, ensure "globals: true" or import { describe, it, expect, vi } and map jest.fn to vi.fn.
 */
import type { Mock } from 'jest-mock';

// We will mock @aws-amplify/backend to capture the schema-building calls.
jest.mock('@aws-amplify/backend', () => {
  // A minimal fluent API mock to capture calls, arguments, and allow assertions.
  // We don't attempt to recreate behavior; we just record structure.
  type AnyObj = Record<string, any>;

  // Builders to capture methods and arguments
  const mkNode = (kind: string, extra: AnyObj = {}) => ({ __kind: kind, ...extra });

  // Primitive type builders return tiny descriptors with chained authorization support
  const withAuth = (node: AnyObj) => ({
    ...node,
    authorization: (fn: (allow: any) => any[]) => {
      const calls = fn(allowApi);
      return { ...node, __auth: calls };
    },
    required: () => ({ ...node, __required: true }),
    enum: undefined, // not used on primitives
    datetime: undefined, // not used on primitives
    json: undefined, // not used on primitives
    string: undefined, // not used on primitives
  });

  const a: any = {
    // field type helpers
    string: () => withAuth(mkNode('string')),
    datetime: () => withAuth(mkNode('datetime')),
    json: () => withAuth(mkNode('json')),
    enum: (vals: string[]) => mkNode('enum', { values: vals }),
    // schema/model helpers
    schema: (defs: Record<string, any>) => mkNode('schema', { defs }),
    model: (fields: Record<string, any>) => {
      let node: AnyObj = mkNode('model', { fields });
      const api = {
        identifier(keys: string[]) {
          node.__identifier = keys;
          return api;
        },
        secondaryIndexes(fn: (index: any) => any[]) {
          const indexesApi = (name: string) => {
            const idx: AnyObj = { name: undefined as string | undefined, partitionKey: name, sortKeys: [] as string[] };
            const chain = Object.assign(
              (pkName: string) => ({ // NOTE: we keep passed pk name
                sortKeys(sk: string[]) {
                  idx.sortKeys = sk;
                  return {
                    name(n: string) {
                      idx.name = n;
                      return idx;
                    },
                  };
                },
              }),
              {}
            );
            return chain(name);
          };
          node.__secondaryIndexes = fn(indexesApi);
          return api;
        },
        authorization(fn: (allow: any) => any[]) {
          node.__modelAuth = fn(allowApi);
          return api;
        },
        // for chaining completion in our mock, return a plain serializable node at the end
        get __node() { return node; },
      };
      return api;
    },
  };

  // Authorization API mock
  const allowApi = {
    ownerDefinedIn: (field: string) => ({ rule: 'ownerDefinedIn', field, to: (ops: string[]) => ({ rule: 'ownerDefinedIn', field, ops }) }),
    publicApiKey: () => ({ rule: 'publicApiKey', to: (ops: string[]) => ({ rule: 'publicApiKey', ops }) }),
  };

  const defineData = (input: { schema: any; authorizationModes: any }) => {
    return { __type: 'data', ...input };
  };

  // Export types to satisfy imports; runtime tests only need the mocks above
  return {
    a,
    defineData,
    // type-only export; at runtime it's ok if undefined
    ClientSchema: (undefined as unknown) as any,
  };
});

describe('Amplify data schema definition (resource.test.ts)', () => {
  // Import after mock is set up, so module under test uses our mock
  const mod = require('../../data/resource.test.ts');

  it('exports data and Schema', () => {
    expect(mod).toHaveProperty('data');
    expect(mod).toHaveProperty('schema'); // the local const in file
    // Schema is a type; at runtime may be undefined. We only assert 'data' exists and has shape
    expect(mod.data).toBeDefined();
    expect(mod.data.__type).toBe('data');
  });

  it('defines two models: Demo and Waitlist', () => {
    const schema = mod.schema;
    expect(schema).toBeDefined();
    expect(schema.__kind).toBe('schema');
    expect(schema.defs).toBeDefined();
    expect(Object.keys(schema.defs)).toEqual(expect.arrayContaining(['Demo', 'Waitlist']));
  });

  describe('Demo model', () => {
    it('has required identifier ["demoId","itemSK"]', () => {
      const demo = mod.schema.defs.Demo.__node ?? mod.schema.defs.Demo;
      expect(demo.__identifier).toEqual(['demoId', 'itemSK']);
    });

    it('includes expected fields with types and required attributes', () => {
      const fields = (mod.schema.defs.Demo.__node ?? mod.schema.defs.Demo).fields;
      // Required string fields
      expect(fields.demoId.__kind).toBe('string');
      expect(fields.demoId.__required).toBe(true);

      expect(fields.itemSK.__kind).toBe('string');
      expect(fields.itemSK.__required).toBe(true);

      // Owner-protected string fields
      expect(fields.ownerId.__kind).toBe('string');
      expect(fields.name.__kind).toBe('string');

      // Enum for status
      expect(fields.status.__kind).toBe('enum');
      expect(fields.status.values).toEqual(['DRAFT', 'PUBLISHED']);

      // Date/time fields
      expect(fields.createdAt.__kind).toBe('datetime');
      expect(fields.updatedAt.__kind).toBe('datetime');

      // Other owner-protected fields
      expect(fields.statusUpdatedAt.__kind).toBe('string');
      expect(fields.s3Key.__kind).toBe('string');
      expect(fields.hotspots.__kind).toBe('json');
    });

    it('applies owner-based authorization on select fields', () => {
      const f = (mod.schema.defs.Demo.__node ?? mod.schema.defs.Demo).fields;
      const ownerProtected = ['ownerId', 'name', 'createdAt', 'updatedAt', 'statusUpdatedAt', 's3Key', 'hotspots'];
      for (const k of ownerProtected) {
        const auth = f[k].__auth;
        expect(Array.isArray(auth)).toBe(true);
        // Ensure at least one ownerDefinedIn('ownerId') rule present
        expect(auth).toEqual(
          expect.arrayContaining([expect.objectContaining({ rule: 'ownerDefinedIn', field: 'ownerId' })])
        );
      }
    });

    it('defines secondary index byOwnerStatus on ownerId with sort key statusUpdatedAt', () => {
      const demo = (mod.schema.defs.Demo.__node ?? mod.schema.defs.Demo);
      const idxs = demo.__secondaryIndexes;
      expect(Array.isArray(idxs)).toBe(true);
      const byOwnerStatus = idxs.find((x: any) => x.name === 'byOwnerStatus');
      expect(byOwnerStatus).toBeDefined();
      expect(byOwnerStatus.partitionKey).toBe('ownerId');
      expect(byOwnerStatus.sortKeys).toEqual(['statusUpdatedAt']);
    });

    it('applies model-level authorization: owner CRUD and public read', () => {
      const demo = (mod.schema.defs.Demo.__node ?? mod.schema.defs.Demo);
      const auth = demo.__modelAuth;
      // Should contain ownerDefinedIn with CRUD ops
      expect(auth).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'ownerDefinedIn',
            field: 'ownerId',
            ops: ['create', 'read', 'update', 'delete'],
          }),
        ])
      );
      // And a publicApiKey read rule
      expect(auth).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'publicApiKey',
            ops: ['read'],
          }),
        ])
      );
    });
  });

  describe('Waitlist model', () => {
    it('has required identifier ["source","timestampEmail"]', () => {
      const waitlist = mod.schema.defs.Waitlist.__node ?? mod.schema.defs.Waitlist;
      expect(waitlist.__identifier).toEqual(['source', 'timestampEmail']);
    });

    it('defines expected fields with requireds and optional createdAt', () => {
      const f = (mod.schema.defs.Waitlist.__node ?? mod.schema.defs.Waitlist).fields;
      expect(f.source.__kind).toBe('string');
      expect(f.source.__required).toBe(true);

      expect(f.timestampEmail.__kind).toBe('string');
      expect(f.timestampEmail.__required).toBe(true);

      expect(f.email.__kind).toBe('string');
      expect(f.email.__required).toBe(true);

      expect(f.createdAt.__kind).toBe('datetime');
      // createdAt optional (no __required flag)
      expect(f.createdAt.__required).toBeUndefined();
    });

    it('allows public api key to create entries', () => {
      const waitlist = (mod.schema.defs.Waitlist.__node ?? mod.schema.defs.Waitlist);
      const auth = waitlist.__modelAuth;
      expect(auth).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'publicApiKey',
            ops: ['create'],
          }),
        ])
      );
    });
  });

  describe('defineData authorization modes', () => {
    it('uses userPool as default and sets apiKey expiry to 30 days', () => {
      const data = mod.data;
      expect(data.authorizationModes).toBeDefined();
      expect(data.authorizationModes.defaultAuthorizationMode).toBe('userPool');
      expect(data.authorizationModes.apiKeyAuthorizationMode).toEqual({ expiresInDays: 30 });
    });
  });
});