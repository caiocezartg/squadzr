import 'server-only'
import { headers } from 'next/headers'
import * as z from 'zod/mini'

/**
 * The header a Worker sets on a subrequest to carry the visitor's address. Cloudflare reads it on a Worker
 * subrequest to a hostname of the same zone and reports it as `CF-Connecting-IP` to the origin, and strips it
 * from every request that no Worker made, so the API sees the visitor's address and a browser cannot choose
 * it.
 */
export const VISITOR_ADDRESS_HEADER = 'x-real-ip'

const addressSchema = z.union([z.ipv4(), z.ipv6()])

/** The address when the value is an IPv4 or IPv6 address, and `null` for anything else. */
export function parseVisitorAddress(value: string | null | undefined): string | null {
  const parsed = addressSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * The address Cloudflare reports for the request being rendered (`CF-Connecting-IP`), or `null` when there
 * is none: a render outside a request, a local server, or a value that is not an address.
 */
export async function getVisitorAddress(): Promise<string | null> {
  try {
    return parseVisitorAddress((await headers()).get('cf-connecting-ip'))
  } catch {
    // Called outside a request scope: nobody to speak for.
    return null
  }
}
