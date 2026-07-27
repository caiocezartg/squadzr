---
status: accepted
---

# Keep Vercel and Railway as deployment targets

The React client remains hosted on Vercel, while the single Fastify instance and managed PostgreSQL database remain on Railway. The modernization cycle adds repository-owned GitHub Actions checks but does not migrate hosting providers, keeping infrastructure change separate from application and architecture refactoring. Merges to `main` deploy automatically only after formatting, lint, typecheck, integration tests, and builds pass; required database migrations run as a controlled pre-deploy gate.
