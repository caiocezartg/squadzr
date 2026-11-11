---
status: accepted
supersedes: 0002
---

# Host the client on Cloudflare Workers and the API on Railway

The Next.js client runs on a Cloudflare Worker at `squadzr.app`. The single Fastify instance and PostgreSQL run on Railway, in one `production` environment, and the API is reached at `api.squadzr.app` through Cloudflare's proxy. Vercel is no longer used, and there is no staging environment. This supersedes [ADR 0002](0002-keep-vercel-and-railway-hosting.md).

We decided six things:

1. **The client is a Worker named `squadzr-web`, built with vinext.** [vinext](https://github.com/cloudflare/vinext) is Cloudflare's documented default for running a Next.js app on Workers. It runs next to the Next config (`client/vite.config.ts`, `client/cloudflare.config.ts`); `next dev`, `next build` and the CI `build` gate are unchanged. A spike (#132) rendered every page correctly on it. No page fits Workers Free (10 ms CPU per request; the measured medians were 14 to 27 ms), so the Worker runs on Workers Paid (US$ 5 a month).
2. **The Worker has no KV namespace and no Images binding.** Without a data cache adapter, a `revalidate` fetch keeps its response in the memory of each isolate for its five minutes. The only such call is the landing's popular games, one small public read, so a cold isolate costs one API call. Without an image optimizer, `next/image` renders the Discord avatar as a plain `<img>` of the original CDN URL, and no request reaches `/_next/image`. Nothing in the app needs either binding, and both would add a resource to keep.
3. **GitHub Actions deploys the Worker, after CI.** `.github/workflows/deploy-client.yml` runs when the CI workflow succeeds on a push to `main`, and deploys the commit CI tested. Workers Builds is not used: it deploys on push without waiting for checks. `main` is promotion-only, so a deploy is a merged promotion pull request, and a push to `development` deploys nothing. The API follows the same rule through Railway's "Wait for CI".
4. **The API refuses a request that did not come through Cloudflare.** A Transform Rule on `api.squadzr.app` overwrites the `x-squadzr-edge-auth` header with a secret on everything it forwards, and the API, when `EDGE_AUTH_TOKEN` is set, answers 403 to a request without the matching value (the two health routes aside, which Railway probes directly). The Next server sends the same secret on its own calls, from a Worker secret, so the lock does not depend on how Cloudflare routes Worker subrequests. The Transform Rule, the Worker secret and `EDGE_AUTH_TOKEN` are one value and change together.
5. **The visitor's address is `CF-Connecting-IP`, believed only behind the lock.** The API believes only the `x-forwarded-for` entries its own proxy appended, counted by `TRUST_PROXY_HOPS`, which stays at 1 (Railway's edge). Railway's edge replaces `x-forwarded-for` with the address that connected to it, so behind Cloudflare that chain never names the visitor. `CF-Connecting-IP` does, and anyone who reaches the Railway origin directly can write it, so the API adopts it only on a request whose edge secret matched. The app and the API share the parent domain `squadzr.app` (`BETTER_AUTH_COOKIE_DOMAIN`), so the session cookie reaches the Next server and is `SameSite=Lax`. Both amendments of ADR 0002 (the cookie domain and the proxy hops) live here now, with the proxy-hops rule rewritten for Cloudflare.
6. **One `production` environment.** Until launch it has no real users and is the test target. A temporary Railway environment can be created for a risky change.

## Consequences

The client now depends on a Workers adapter and, on the Cloudflare path, vinext replaces the Next runtime in production. [ADR 0004](0004-run-the-client-on-next-app-router.md) says the client uses no hosting-specific APIs; that still holds for the source (no `cloudflare:workers` import, no Cloudflare package imported by application code), but the production runtime is no longer Next's own, and the build adds `vinext`, `@vinext/cloudflare`, `vite` and the Cloudflare Vite plugin, several of them beta. A move to another host stays a hosting change, but a Next feature vinext does not implement stops working on the Worker before it stops working on Next. The spike lists the known differences from stock Next (no `x-powered-by`, a larger `<head>`, no image resizing).

Cloudflare owns the zone's rules outside this repository: the Transform Rule, the single rate limiting rule the Free plan allows (all of `api.squadzr.app`, per IP), the `www.squadzr.app` redirect and the DNS records. [The runbook](../ops/client-on-cloudflare-workers.md) lists them and the rotation of the edge secret.

The hosting cost is Railway's usage plus Workers Paid.
