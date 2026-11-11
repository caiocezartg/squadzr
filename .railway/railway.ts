import { defineRailway, github, image, preserve, project, service, volume } from 'railway/iac'

const MIB = 1024 * 1024

/**
 * The hosted backend (CCC-91, #133): one Railway project, one `production`
 * environment with the PostgreSQL 16 database, the `api` service that serves the
 * app and owns the schema migrations, and the `games-import` cron service that
 * runs the Catalog Import every day.
 *
 * Railway reads this file through the CLI (`railway config plan` and
 * `railway config apply`), from the repository root, so the environment is
 * reproducible from code. It replaces Config as Code (`railway.json`), which
 * Railway deprecated and stops reading on 2026-12-01.
 */
export default defineRailway(() => {
  const postgresData = volume('postgres-data', { region: 'us-east4-eqdc4a', sizeMB: 5000 })

  // Railway's PostgreSQL template now ships 18; the integration suite runs on
  // 16, so this service pins the major version of the same Railway image.
  const postgres = service('postgres', {
    source: image('ghcr.io/railwayapp-templates/postgres-ssl:16'),
    env: {
      PGDATA: '/var/lib/postgresql/data/pgdata',
      POSTGRES_USER: 'postgres',
      POSTGRES_DB: 'squadzr',
      // The owner sets the password in Railway; no secret lives in the repo.
      POSTGRES_PASSWORD: preserve(),
      PGUSER: '${{POSTGRES_USER}}',
      PGPASSWORD: '${{POSTGRES_PASSWORD}}',
      PGDATABASE: '${{POSTGRES_DB}}',
      PGHOST: '${{RAILWAY_PRIVATE_DOMAIN}}',
      PGPORT: '5432',
      DATABASE_URL:
        'postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}',
      SSL_CERT_DAYS: '820',
      RAILWAY_DEPLOYMENT_DRAINING_SECONDS: '60',
    },
    deploy: {
      // A ceiling, not a reservation: Railway bills what the service uses, and the limit caps the worst case.
      limitOverride: { containers: { cpu: 1, memoryBytes: 512 * MIB } },
    },
    volumeMounts: {
      '/var/lib/postgresql/data': postgresData,
    },
  })

  const gamesImport = service('games-import', {
    // checkSuites is Railway's "Wait for CI": a push deploys only after its GitHub checks pass.
    source: github('caiocezartg/squadzr', { branch: 'main', checkSuites: true }),
    build: {
      builder: 'RAILPACK',
      buildCommand: 'bun install --frozen-lockfile',
      watchPatterns: ['server/**', 'packages/**'],
    },
    deploy: {
      startCommand: 'cd server && bun --no-env-file src/interface/scripts/import-games.ts',
      cronSchedule: '0 4 * * *',
      restartPolicyType: 'NEVER',
    },
    env: {
      DATABASE_URL: postgres.env.DATABASE_URL,
      // The owner sets both in Railway; the import is the only consumer.
      IGDB_CLIENT_ID: preserve(),
      IGDB_CLIENT_SECRET: preserve(),
    },
  })

  const api = service('api', {
    // checkSuites is Railway's "Wait for CI". `main` is the release branch: `development` only
    // pre-tests changes and reaches production through the promotion pull request.
    source: github('caiocezartg/squadzr', { branch: 'main', checkSuites: true }),
    build: {
      builder: 'RAILPACK',
      buildCommand: 'bun install --frozen-lockfile',
      watchPatterns: ['server/**', 'packages/**', 'package.json', 'bun.lock'],
    },
    deploy: {
      startCommand: 'cd server && bun --no-env-file src/index.ts',
      // The one service that owns schema changes: a failing migration stops the deploy and the
      // previous deployment keeps serving.
      preDeployCommand: ['cd server && bun --no-env-file src/interface/scripts/migrate.ts'],
      healthcheckPath: '/health/ready',
      limitOverride: { containers: { cpu: 1, memoryBytes: 512 * MIB } },
    },
    networking: {
      customDomains: { 'api.squadzr.app': {} },
    },
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      CORS_ORIGIN: 'https://squadzr.app',
      BETTER_AUTH_URL: 'https://api.squadzr.app',
      BETTER_AUTH_COOKIE_DOMAIN: 'squadzr.app',
      // Railway's edge is the one proxy whose x-forwarded-for is believed. It replaces the header with the
      // address that connected to it, which behind Cloudflare is Cloudflare's: more hops would trust nothing
      // more. The visitor's address comes from CF-Connecting-IP, adopted only on a request that carries the
      // edge secret (EDGE_AUTH_TOKEN).
      TRUST_PROXY_HOPS: '1',
      // SIGTERM closes the sockets and lets a running Catalog Import finish before the kill.
      RAILWAY_DEPLOYMENT_DRAINING_SECONDS: '60',
      DATABASE_URL: postgres.env.DATABASE_URL,
      // None of the secrets is in the repository: the owner sets them in Railway.
      BETTER_AUTH_SECRET: preserve(),
      DISCORD_CLIENT_ID: preserve(),
      DISCORD_CLIENT_SECRET: preserve(),
      // The origin lock: the same secret the Cloudflare Transform Rule writes and the Worker sends. The
      // owner sets it in Railway when the lock is turned on, and changes it together with those two.
      EDGE_AUTH_TOKEN: preserve(),
      // The manual Catalog Import from the admin panel reads the same IGDB credentials as the cron.
      IGDB_CLIENT_ID: gamesImport.env.IGDB_CLIENT_ID,
      IGDB_CLIENT_SECRET: gamesImport.env.IGDB_CLIENT_SECRET,
    },
  })

  return project('squadzr', { resources: [postgres, postgresData, api, gamesImport] })
})
