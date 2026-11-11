import { isIPv6 } from 'node:net'

/**
 * The key a client address is counted under: an IPv4 address as it is, an IPv4-mapped IPv6 address as its
 * IPv4 form, and any other IPv6 address by its /64 prefix, because one subscriber holds a whole /64 and
 * could otherwise open sockets from as many addresses as they like. It matches how the HTTP rate limiter
 * groups addresses.
 */
export function addressKey(address: string): string {
  const lower = address.toLowerCase()
  if (!isIPv6(lower)) return lower

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower)
  if (mapped?.[1]) return mapped[1]

  const [head = '', tail] = lower.split('::')
  const headGroups = head === '' ? [] : head.split(':')
  const tailGroups = tail === undefined || tail === '' ? [] : tail.split(':')
  const zeros = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length
  const groups = [...headGroups, ...Array<string>(Math.max(zeros, 0)).fill('0'), ...tailGroups]

  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/** How many WebSockets each client address holds open, and whether it may open another. */
export class AddressConnections {
  private readonly open = new Map<string, number>()

  /** @param limit Sockets one address may hold at once; 0 means no limit. */
  constructor(private readonly limit: number) {}

  /** Counts a new socket for the address, or returns false (counting nothing) when it holds the limit already. */
  acquire(address: string): boolean {
    const key = addressKey(address)
    const held = this.open.get(key) ?? 0
    if (this.limit > 0 && held >= this.limit) return false

    this.open.set(key, held + 1)
    return true
  }

  /** Counts a socket of the address as closed. */
  release(address: string): void {
    const key = addressKey(address)
    const held = this.open.get(key) ?? 0
    if (held <= 1) this.open.delete(key)
    else this.open.set(key, held - 1)
  }
}
