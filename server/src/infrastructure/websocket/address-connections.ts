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

  const groups = ipv6Groups(lower)
  // ::ffff:a.b.c.d (written with an IPv4 tail or as two hextets) is the IPv4 address a.b.c.d.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6)
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
  }

  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`
}

/** The eight 16-bit groups of a valid IPv6 address, with `::` expanded and an IPv4 tail read as two groups. */
function ipv6Groups(address: string): number[] {
  const [head = '', tail] = address.split('::')
  const parse = (part: string): number[] =>
    part === ''
      ? []
      : part.split(':').flatMap((group) => {
          if (!group.includes('.')) return [parseInt(group, 16)]
          const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number)
          return [(a << 8) | b, (c << 8) | d]
        })
  const headGroups = parse(head)
  const tailGroups = tail === undefined ? [] : parse(tail)
  const zeros = Array<number>(Math.max(8 - headGroups.length - tailGroups.length, 0)).fill(0)

  return [...headGroups, ...zeros, ...tailGroups]
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
