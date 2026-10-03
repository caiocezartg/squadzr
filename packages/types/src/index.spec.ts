import { describe, expect, it } from 'vitest'
import * as sharedTypes from './index'

// @squadzr/types is intentionally type-only (ADR-0001): every export is a static
// type with no runtime representation, so its entry point exposes an empty
// namespace at runtime. The transport contracts that used to be duplicated here
// (rooms, games, users, notifications, HTTP responses and WebSocket payloads)
// are inferred from the Zod schemas in @squadzr/schemas, whose suite pins both
// their runtime validation and their inferred types.
describe('@squadzr/types', () => {
  it('loads its entry point in Node without any runtime export', () => {
    expect(sharedTypes).toBeTypeOf('object')
    expect(Object.keys(sharedTypes)).toEqual([])
  })
})
