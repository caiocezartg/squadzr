---
status: accepted
---

# Run the client on the Next.js App Router

The client moves from Vite and TanStack Router to Next.js 16 with the App Router, following Next's official "Migrating from Vite" path. A shared Squad link needs a server-rendered first view to show its preview, and the session can reach the server only once the app and the API share a parent domain. We decided five things:

1. The client runs on the Next.js App Router.
2. Every route renders its first view on the server with the viewer's session.
3. App and API share a parent domain, so the session cookie reaches the Next server.
4. Fastify stays the only backend. Next renders pages and reads data from the API; it has no route handlers, server actions or database access.
5. The client's source uses no hosting-specific APIs and no `@vercel/*` package, so a move to another host stays a hosting change.

## Consequences

Routes move to the App Router one at a time. Until a route moves, the catch-all route renders the current app on the client only, with TanStack Router, so every step keeps the app working.

Amended in #135: ADR 0002 is superseded by [ADR 0006](0006-host-on-cloudflare-workers-and-railway.md), and the client runs on a Cloudflare Worker. Decision 5 still holds for the source, whose application code imports no Cloudflare or Vercel package. It no longer holds for the production runtime: the Worker runs the app with vinext, which replaces the Next runtime there, and the build adds a Workers adapter (`client/vite.config.ts`, `client/cloudflare.config.ts` and their dependencies). `next dev`, `next build` and the CI `build` gate are unchanged.
