/**
 * The request header that proves a request came through the Cloudflare edge. The edge overwrites it on
 * everything it forwards to the API, the Next server sends it on its own calls, and the API (when
 * `EDGE_AUTH_TOKEN` is set) refuses a request that lacks the matching value.
 */
export const EDGE_AUTH_HEADER = 'x-squadzr-edge-auth'
