---
status: accepted
---

# Run the client on the Next.js App Router

The client moves from Vite and TanStack Router to Next.js 16 with the App Router, following Next's official "Migrating from Vite" path. A shared Squad link needs a server-rendered first view to show its preview, and the session can reach the server only once the app and the API share a parent domain. We decided five things:

1. The client runs on the Next.js App Router.
2. Every route renders its first view on the server with the viewer's session.
3. App and API share a parent domain, so the session cookie reaches the Next server.
4. Fastify stays the only backend. Next renders pages and reads data from the API; it has no route handlers, server actions or database access.
5. The client uses no hosting-specific APIs and no `@vercel/*` package, so a move to another host stays a hosting change.

## Consequences

Routes move to the App Router one at a time. Until a route moves, the catch-all route renders the current app on the client only, with TanStack Router, so every step keeps the app working. Hosting does not change, so ADR 0002 still holds.
