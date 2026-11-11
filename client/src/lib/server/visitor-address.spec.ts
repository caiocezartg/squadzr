import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'
import { getVisitorAddress, parseVisitorAddress } from './visitor-address'

const headersMock = vi.mocked(headers)

function incoming(values: Record<string, string>) {
  headersMock.mockResolvedValue(new Headers(values) as Awaited<ReturnType<typeof headers>>)
}

beforeEach(() => {
  headersMock.mockReset()
})

describe('parseVisitorAddress', () => {
  it.each(['203.0.113.9', '2804:1b3:aa80:d188:64ed:92bf:8a0f:2787', '::1'])('keeps %s', (value) => {
    expect(parseVisitorAddress(value)).toBe(value)
  })

  it.each([
    null,
    undefined,
    '',
    'garbage',
    '203.0.113.9, 198.51.100.1',
    '203.0.113.256',
    '203.0.113.9\r\nx-evil: 1',
    '<script>',
  ])('refuses %j', (value) => {
    expect(parseVisitorAddress(value)).toBeNull()
  })
})

describe('getVisitorAddress', () => {
  it('reads the address Cloudflare reports for the request', async () => {
    incoming({ 'cf-connecting-ip': '203.0.113.9' })

    expect(await getVisitorAddress()).toBe('203.0.113.9')
  })

  it('does not read the header a visitor could write for themselves', async () => {
    incoming({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' })

    expect(await getVisitorAddress()).toBeNull()
  })

  it('has no address when the header is not one', async () => {
    incoming({ 'cf-connecting-ip': 'nope' })

    expect(await getVisitorAddress()).toBeNull()
  })

  it('has no address outside a request', async () => {
    headersMock.mockRejectedValue(new Error('`headers` was called outside a request scope'))

    expect(await getVisitorAddress()).toBeNull()
  })
})
