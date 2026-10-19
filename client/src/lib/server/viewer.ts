import 'server-only'
import { headers } from 'next/headers'

/** The viewer who sent the current request, as the calls that speak for them need it. */
export interface RequestViewer {
  /** The viewer's cookies, so Fastify reads their session. */
  readonly cookie: string | null
  /** The viewer's `x-forwarded-for`, so Fastify rate-limits the viewer and not the Next server. */
  readonly forwardedFor: string | null
}

/** The viewer of the current request. */
export async function getRequestViewer(): Promise<RequestViewer> {
  const requestHeaders = await headers()
  return {
    cookie: requestHeaders.get('cookie'),
    forwardedFor: requestHeaders.get('x-forwarded-for'),
  }
}
