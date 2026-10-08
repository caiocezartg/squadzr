import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDatabaseEnv, loadEnv } from './env'

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/squadzr'

/** Turns `process.exit` into a throw, so a failing load ends the test instead of the runner. */
function stubProcessExit() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  return vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadDatabaseEnv', () => {
  it('loads from DATABASE_URL alone, without the auth or Discord settings', () => {
    expect(loadDatabaseEnv({ DATABASE_URL })).toEqual({ DATABASE_URL })
  })

  it('exits the process when DATABASE_URL is missing or is not a URL', () => {
    const exit = stubProcessExit()

    expect(() => loadDatabaseEnv({})).toThrow('process.exit(1)')
    expect(() => loadDatabaseEnv({ DATABASE_URL: 'not-a-url' })).toThrow('process.exit(1)')
    expect(exit).toHaveBeenCalledWith(1)
  })
})

describe('loadEnv', () => {
  it('still requires the server settings that the database loader leaves out', () => {
    const exit = stubProcessExit()

    expect(() => loadEnv({ DATABASE_URL })).toThrow('process.exit(1)')
    expect(exit).toHaveBeenCalledWith(1)
  })
})
