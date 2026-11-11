import { describe, expect, it } from 'vitest'
import { titleSize } from './title-size'

describe('titleSize', () => {
  it('shrinks the name as it grows', () => {
    expect(titleSize('Valorant')).toBe(112)
    expect(titleSize('Counter-Strike 2')).toBe(92)
    expect(titleSize('League of Legends')).toBe(76)
    expect(titleSize("Tom Clancy's Rainbow Six Siege X")).toBe(60)
  })
})
