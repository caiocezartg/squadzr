import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_IGDB_POPULARITY_THRESHOLD,
  loadCatalogImportEnv,
  parseCatalogImportEnv,
} from './catalog-import-env'

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/squadzr',
  IGDB_CLIENT_ID: 'igdb-client-id',
  IGDB_CLIENT_SECRET: 'igdb-client-secret',
}

// CCC-90: the import owns a small environment schema. It must not require the
// API's auth or Discord variables, and the threshold and narrowing override are
// optional.
describe('parseCatalogImportEnv', () => {
  it('accepts the database URL and the IGDB credentials alone', () => {
    expect(parseCatalogImportEnv(REQUIRED_ENV)).toEqual({
      DATABASE_URL: REQUIRED_ENV.DATABASE_URL,
      IGDB_CLIENT_ID: REQUIRED_ENV.IGDB_CLIENT_ID,
      IGDB_CLIENT_SECRET: REQUIRED_ENV.IGDB_CLIENT_SECRET,
      IGDB_POPULARITY_THRESHOLD: DEFAULT_IGDB_POPULARITY_THRESHOLD,
      CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK: false,
    })
  })

  it('reads an explicit threshold and the narrowing override', () => {
    const env = parseCatalogImportEnv({
      ...REQUIRED_ENV,
      IGDB_POPULARITY_THRESHOLD: '120',
      CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK: 'true',
    })

    expect(env.IGDB_POPULARITY_THRESHOLD).toBe(120)
    expect(env.CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK).toBe(true)
  })

  it('treats an empty optional value as unset', () => {
    const env = parseCatalogImportEnv({
      ...REQUIRED_ENV,
      IGDB_POPULARITY_THRESHOLD: '',
      CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK: '',
    })

    expect(env.IGDB_POPULARITY_THRESHOLD).toBe(DEFAULT_IGDB_POPULARITY_THRESHOLD)
    expect(env.CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK).toBe(false)
  })

  it.each(['DATABASE_URL', 'IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'] as const)(
    'rejects a missing %s',
    (key) => {
      const source: Record<string, string> = { ...REQUIRED_ENV }
      delete source[key]

      expect(() => parseCatalogImportEnv(source)).toThrow(
        'Invalid catalog import environment variables'
      )
    }
  )

  it('rejects a threshold that is not a non-negative integer', () => {
    expect(() =>
      parseCatalogImportEnv({ ...REQUIRED_ENV, IGDB_POPULARITY_THRESHOLD: '-1' })
    ).toThrow('Invalid catalog import environment variables')
  })

  it('rejects an override that is not a boolean', () => {
    expect(() =>
      parseCatalogImportEnv({
        ...REQUIRED_ENV,
        CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK: 'yes please',
      })
    ).toThrow('Invalid catalog import environment variables')
  })
})

describe('loadCatalogImportEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stops the import when the environment is invalid', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => loadCatalogImportEnv({ ...REQUIRED_ENV, IGDB_CLIENT_SECRET: '' })).toThrow(
      'process.exit'
    )
    expect(exit).toHaveBeenCalledWith(1)
  })
})
