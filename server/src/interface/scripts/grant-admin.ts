import { loadDatabaseEnv } from '@config/env'
import { runGrantAdmin } from '@interface/admin/grant-admin-entry'

/**
 * `admin:grant <id>`: makes the person with that user id, or else that Discord id, an admin. Like the
 * migrate script it reads only `DATABASE_URL` from the process environment and never a file, so run it
 * where the variable is injected (`railway run bun run admin:grant <id>`, or with the variable set).
 */
async function main(): Promise<void> {
  const identifier = process.argv.slice(2).join(' ').trim()
  if (!identifier || process.argv.length !== 3) {
    console.error('Usage: bun run admin:grant <user id or Discord id>')
    process.exitCode = 1
    return
  }

  const { DATABASE_URL } = loadDatabaseEnv()
  process.exitCode = await runGrantAdmin({ databaseUrl: DATABASE_URL, identifier })
}

main().catch((error) => {
  console.error('Granting the admin role failed:', error)
  process.exitCode = 1
})
