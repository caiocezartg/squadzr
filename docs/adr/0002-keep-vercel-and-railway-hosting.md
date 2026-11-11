---
status: superseded
superseded-by: 0006
---

# Keep Vercel and Railway as deployment targets

> Superseded by [ADR 0006](0006-host-on-cloudflare-workers-and-railway.md): the client no longer runs on Vercel. The text below is the decision as it was taken; its two amendments, on the cookie domain and the proxy hops, were carried into ADR 0006.

The React client remains hosted on Vercel, while the single Fastify instance and managed PostgreSQL database remain on Railway. The modernization cycle adds repository-owned GitHub Actions checks but does not migrate hosting providers, keeping infrastructure change separate from application and architecture refactoring. Merges to `main` deploy automatically only after formatting, lint, typecheck, integration tests, and builds pass; required database migrations run as a controlled pre-deploy gate.

Amended in CCC-74: the app and the API share a parent domain (`squadzr.app` and an API subdomain), so the session cookie reaches the Next server and can be `SameSite=Lax`. The server turns this on with `BETTER_AUTH_COOKIE_DOMAIN`. The hosting providers do not change: the app stays on Vercel and the API on Railway. Buying the domain and configuring its DNS are manual steps for the owner.

Amended in the pre-merge security audit of Redesign v2: the API believes only the `x-forwarded-for` entries its own proxies appended, counted by `TRUST_PROXY_HOPS` (default 1, Railway's edge). The browser and the WebSocket reach the API directly, so a higher count would let a client write its own address again; adding a CDN or WAF in front of Railway is the one change that raises it. The API also refuses every change of state and every WebSocket opened from an origin other than `CORS_ORIGIN` or `BETTER_AUTH_URL`, so `CORS_ORIGIN` must be the exact origin the app is served from.
