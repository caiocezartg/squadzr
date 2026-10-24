import { defineRailway, github, image, preserve, project, service, volume } from 'railway/iac'

/**
 * The hosted Catalog Import (CCC-91): one Railway project, one `staging`
 * environment with the PostgreSQL 16 database the import writes to and the
 * `games-import` cron service that runs it every day.
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
    volumeMounts: {
      '/var/lib/postgresql/data': postgresData,
    },
  })

  const gamesImport = service('games-import', {
    source: github('caiocezartg/squadzr', { branch: 'igdb-catalog' }),
    build: {
      builder: 'RAILPACK',
      buildCommand: 'bun install --frozen-lockfile',
      watchPatterns: ['server/**', 'packages/**'],
    },
    deploy: {
      startCommand: 'cd server && bun --no-env-file src/interface/scripts/import-games.ts',
      preDeployCommand: ['cd server && bun --no-env-file src/interface/scripts/migrate.ts'],
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

  return project('squadzr', { resources: [postgres, postgresData, gamesImport] })
})
