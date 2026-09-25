import { describe, expect, it } from 'vitest'
import * as sharedTypes from './index'
import * as apiTypes from './api'
import * as wsTypes from './ws'

describe('@squadzr/types', () => {
  it('loads every contract entry point in Node', () => {
    expect(sharedTypes).toBeTypeOf('object')
    expect(apiTypes).toBeTypeOf('object')
    expect(wsTypes).toBeTypeOf('object')
  })
})
