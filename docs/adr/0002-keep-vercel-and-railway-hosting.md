---
status: accepted
---

# Keep Vercel and Railway as deployment targets

The React client remains hosted on Vercel, while the single Fastify instance and managed PostgreSQL database remain on Railway. The modernization cycle adds repository-owned GitHub Actions checks but does not migrate hosting providers, keeping infrastructure change separate from application and architecture refactoring. Merges to `main` deploy automatically only after formatting, lint, typecheck, integration tests, and builds pass; required database migrations run as a controlled pre-deploy gate.

Amended in CCC-74: the app and the API share a parent domain (`squadzr.app` and an API subdomain), so the session cookie reaches the Next server and can be `SameSite=Lax`. The server turns this on with `BETTER_AUTH_COOKIE_DOMAIN`. The hosting providers do not change: the app stays on Vercel and the API on Railway. Buying the domain and configuring its DNS are manual steps for the owner.
