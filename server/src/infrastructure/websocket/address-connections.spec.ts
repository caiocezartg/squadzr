import { describe, expect, it } from 'vitest'
import { AddressConnections, addressKey } from './address-connections'

describe('addressKey', () => {
  it('keeps an IPv4 address', () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7')
  })

  it('counts an IPv4-mapped IPv6 address as its IPv4 form', () => {
    expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('groups IPv6 addresses by their /64 prefix', () => {
    const first = addressKey('2804:1b3:aa80:d188:64ed:92bf:8a0f:2787')
    const sameSubnet = addressKey('2804:1b3:aa80:d188::1')

    expect(first).toBe('2804:1b3:aa80:d188::/64')
    expect(sameSubnet).toBe(first)
    expect(addressKey('2804:1b3:aa80:d189::1')).not.toBe(first)
  })

  it('reads a compressed prefix and is not case sensitive', () => {
    expect(addressKey('2A06:98C0:3600::5')).toBe('2a06:98c0:3600:0::/64')
    expect(addressKey('::1')).toBe('0:0:0:0::/64')
  })
})

describe('AddressConnections', () => {
  it('refuses a socket past the limit and takes it again once one closes', () => {
    const connections = new AddressConnections(2)

    expect(connections.acquire('203.0.113.7')).toBe(true)
    expect(connections.acquire('203.0.113.7')).toBe(true)
    expect(connections.acquire('203.0.113.7')).toBe(false)
    expect(connections.acquire('203.0.113.8')).toBe(true)

    connections.release('203.0.113.7')

    expect(connections.acquire('203.0.113.7')).toBe(true)
  })

  it('counts every address of one IPv6 /64 together', () => {
    const connections = new AddressConnections(1)

    expect(connections.acquire('2804:1b3:aa80:d188::1')).toBe(true)
    expect(connections.acquire('2804:1b3:aa80:d188::2')).toBe(false)
  })

  it('does not limit when the limit is 0', () => {
    const connections = new AddressConnections(0)

    for (let i = 0; i < 50; i += 1) expect(connections.acquire('203.0.113.7')).toBe(true)
  })

  it('ignores a release for an address that holds nothing', () => {
    const connections = new AddressConnections(1)

    connections.release('203.0.113.7')

    expect(connections.acquire('203.0.113.7')).toBe(true)
    expect(connections.acquire('203.0.113.7')).toBe(false)
  })
})
