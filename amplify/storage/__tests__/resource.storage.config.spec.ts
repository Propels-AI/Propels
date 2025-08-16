/**
 * Tests for amplify/storage/resource.test.ts
 * Testing framework: Jest
 *
 * These tests validate that defineStorage is invoked with the correct configuration:
 *  - name property is "demo-screenshots-storage"
 *  - access contains the "public/demos/{userId}/*" rule
 *  - authenticated has ["read", "write"], guest has ["read"]
 *  - exported 'storage' equals the mocked return from defineStorage
 */
import type { Mock } from 'jest-mock'

jest.mock('@aws-amplify/backend', () => {
  return {
    defineStorage: jest.fn(() => ({ __type: 'MockStorageResource' })),
  }
})

const { defineStorage } = jest.requireMock('@aws-amplify/backend') as {
  defineStorage: Mock<any, any>
}

// Import after mocking so the module-under-test uses the mocked defineStorage
import * as mod from '../../resource.test'

describe('amplify/storage/resource.test.ts storage definition', () => {
  it('calls defineStorage exactly once', () => {
    expect(defineStorage).toHaveBeenCalledTimes(1)
  })

  it('exports storage that equals the mocked return value', () => {
    expect(mod.storage).toEqual({ __type: 'MockStorageResource' })
  })

  it('passes a config with the correct name and access shape', () => {
    expect(defineStorage).toHaveBeenCalledTimes(1)
    const config = (defineStorage as jest.Mock).mock.calls[0][0]
    expect(config).toBeTruthy()
    expect(config.name).toBe('demo-screenshots-storage')
    expect(typeof config.access).toBe('function')
  })

  it('defines correct access rules for "public/demos/{userId}/*"', () => {
    const config = (defineStorage as jest.Mock).mock.calls[0][0]

    const calls: Array<{ subject: 'authenticated' | 'guest', perms: string[] }> = []
    const allow = {
      authenticated: {
        to: (perms: string[]) => {
          calls.push({ subject: 'authenticated', perms })
          return { subject: 'authenticated', perms }
        },
      },
      guest: {
        to: (perms: string[]) => {
          calls.push({ subject: 'guest', perms })
          return { subject: 'guest', perms }
        },
      },
    }

    const result = config.access(allow)
    const key = 'public/demos/{userId}/*'
    expect(Object.prototype.hasOwnProperty.call(result, key)).toBe(true)

    const arr = result[key]
    expect(Array.isArray(arr)).toBe(true)
    expect(arr).toHaveLength(2)

    // Check returned values from to()
    const authEntry = arr.find((e: any) => e.subject === 'authenticated')
    const guestEntry = arr.find((e: any) => e.subject === 'guest')

    expect(authEntry).toBeDefined()
    expect(guestEntry).toBeDefined()

    expect(authEntry.perms).toEqual(['read', 'write'])
    expect(guestEntry.perms).toEqual(['read'])

    // Also verify that 'to' was called with those exact arrays
    expect(calls).toEqual(
      expect.arrayContaining([
        { subject: 'authenticated', perms: ['read', 'write'] },
        { subject: 'guest', perms: ['read'] },
      ])
    )
  })

  it('is resilient if access callback returns unexpected shape', () => {
    const config = (defineStorage as jest.Mock).mock.calls[0][0]
    // If someone changes the implementation, ensure it still returns an object
    const output = config.access({
      authenticated: { to: (_: string[]) => ({ subject: 'authenticated', perms: [] }) },
      guest: { to: (_: string[]) => ({ subject: 'guest', perms: [] }) },
    })
    expect(output && typeof output).toBe('object')
  })
})