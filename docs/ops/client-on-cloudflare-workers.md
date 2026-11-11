# The client on Cloudflare Workers

The Next.js client runs as the Worker `squadzr-web` at `https://squadzr.app`, built with
[vinext](https://github.com/cloudflare/vinext). The API runs on Railway at `https://api.squadzr.app`
(`docs/ops/catalog-import-railway.md`). The decision and its consequences are in
[ADR 0006](../adr/0006-host-on-cloudflare-workers-and-railway.md).

## What is in the repository

|                    |                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker config      | `client/cloudflare.config.ts`: the name, the `squadzr.app` custom domain, `nodejs_compat`, the static assets and the `EDGE_AUTH_TOKEN` secret |
| Build config       | `client/vite.config.ts`: the vinext and Cloudflare Vite plugins, with no cache adapter and no image optimizer                                  |
| Deploy workflow    | `.github/workflows/deploy-client.yml`                                                                                                          |
| Scripts            | `bun run build:vinext`, `bun run start:vinext` (local preview in workerd), `bun run deploy:vinext` (build and deploy), all in `client/`        |
| Generated (ignored) | `client/.vinext/` and `client/.cloudflare/`                                                                                                   |

`next dev`, `next build` and the CI `build` gate do not use the Cloudflare files.

## Deploys

GitHub runs a `workflow_run` workflow as it is on the default branch (`main`), so the first deploy happens
only after the promotion pull request that brings `deploy-client.yml` into `main`; until then merging to
`development` deploys nothing.

A push to `main` runs the CI workflow; when it succeeds, `Deploy client` builds the commit CI tested
with `NEXT_PUBLIC_API_URL=https://api.squadzr.app` and deploys it to the Worker. A failing CI run, a push
to `development` and a pull request deploy nothing. `main` only receives promotion pull requests, so a
deploy is a merged promotion.

The workflow needs two repository secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID`: the account id.
- `CLOUDFLARE_API_TOKEN`: an API token that can edit Workers scripts on the account and the Workers
  routes and DNS of the `squadzr.app` zone (the custom domain creates its DNS record).

To deploy by hand (the same build the workflow makes), sign in once with `cf auth create <profile>`
(a browser approval) and run, in `client/`:

```
NEXT_PUBLIC_API_URL=https://api.squadzr.app bun run deploy:vinext
```

To look at the build before deploying, `bun run build:vinext` then `bun run start:vinext` serves it in
workerd on `localhost` (the API URL is read at build time). Local Worker secrets go in `client/.dev.vars`,
which git ignores.

## The `revalidate` cache without KV

The Worker has no KV namespace. Next's `revalidate` cache therefore lives in each isolate's memory: the
only call that uses it, the landing's popular games (`/api/games/popular`, five minutes), is read once per
isolate per five minutes instead of once per five minutes overall. A cold isolate, and each new isolate
after a deploy, calls the API once. Calls that read a viewer's data are never cached.

Images are not optimized: `next/image` renders Discord avatars as a plain `<img>` of the original
`cdn.discordapp.com` URL, and no request reaches `/_next/image`.

## The edge secret

The secret is one value in three places, and the three change together:

1. the **Transform Rule** on `api.squadzr.app` (Cloudflare, `http_request_late_transform`), which writes it
   in the `x-squadzr-edge-auth` request header on everything sent to the API;
2. the **Worker secret** `EDGE_AUTH_TOKEN` on `squadzr-web`, which the Next server sends in the same header
   on its own calls (`client/src/lib/server/api.ts`; it reads `process.env`, which the `nodejs_compat`
   flag fills from the Worker's bindings);
3. the Railway variable `EDGE_AUTH_TOKEN` on `api` (a `preserve()`d variable in `.railway/railway.ts`),
   which turns the origin lock on.

The value is at least 32 visible ASCII characters (both sides validate it with Zod). To rotate it, generate
a new random value without echoing it and update the three places back to back. Until the last one is
done, some requests carry the old value and are refused with 403 `EDGE_AUTH_REQUIRED`, so do it when
nobody is online and open `https://squadzr.app` afterwards. The value never goes in a commit, an issue, a
log or a chat. Never pass the value on a command line (`--text <value>` lands in the shell history and the
process list). Write it to a file outside the repository that only you can read, as the JSON
`{"EDGE_AUTH_TOKEN": {"type": "secret_text", "text": "<value>"}}`, set the secret from the file and delete
the file at once:

```
cf workers secrets bulk --worker squadzr-web --secrets @<path to the file>
```

## Rules in the Cloudflare zone

These live in the `squadzr.app` zone (Free plan), outside this repository:

- **DNS.** `squadzr.app` is attached to the Worker as a custom domain (the deploy creates its record).
  `www` has a proxied placeholder record so the redirect below can match.
- **Redirect rule.** `www.squadzr.app/*` → `https://squadzr.app/${path}` (301, query string kept).
- **Transform Rule** on `api.squadzr.app`: see "The edge secret".
- **Rate limiting rule** (the one the Free plan allows): every request to `api.squadzr.app`, 100 requests
  per 10 seconds per IP, then blocked for 10 seconds with a 429. A page load costs a handful of API calls
  and the WebSocket is one upgrade, so ordinary use stays far below it; hammering a route does not.
  Better Auth keeps its own, stricter limit on sign-in (3 per 10 seconds).
- Bot Fight Mode and Turnstile are not used.
