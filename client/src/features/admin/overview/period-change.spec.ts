import { describe, expect, it } from 'vitest'
import { periodChange } from './period-change'

describe('periodChange', () => {
  it('is the growth over the previous period', () => {
    expect(periodChange(118, 100)).toEqual({ trend: 'up', ratio: 0.18 })
  })

  it('is the drop, as a positive ratio, when the period fell', () => {
    expect(periodChange(96, 100)).toEqual({ trend: 'down', ratio: 0.04 })
  })

  it('is flat when both periods match', () => {
    expect(periodChange(40, 40)).toEqual({ trend: 'flat', ratio: 0 })
  })

  it('is new, with no percentage, when only the current period has any', () => {
    expect(periodChange(12, 0)).toEqual({ trend: 'new' })
  })

  it('is none when neither period has any', () => {
    expect(periodChange(0, 0)).toEqual({ trend: 'none' })
  })

  it('falls the whole way when the current period has none', () => {
    expect(periodChange(0, 25)).toEqual({ trend: 'down', ratio: 1 })
  })
})
