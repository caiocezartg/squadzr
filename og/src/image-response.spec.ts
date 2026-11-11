import { describe, expect, it } from 'vitest'
import { imageResponse } from './image-response'

describe('imageResponse', () => {
  it('answers a JPEG cached as immutable for a year', async () => {
    const response = imageResponse(new Uint8Array([0xff, 0xd8, 0xff]))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('content-length')).toBe('3')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]))
  })
})
