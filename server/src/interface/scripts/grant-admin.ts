import { loadDatabaseEnv } from '@config/env'
import { runGrantAdmin } from '@interface/admin/grant-admin-entry'

const USAGE = 'Usage: bun run admin:grant [--owner] <user id or Discord id>'

/**
 * `admin:grant <id>`: makes the person with that user id, or else that Discord id, an admin; with
 * `--owner` it makes them the owner instead (at most one owner exists, and the script never demotes
 * anyone). Like the migrate script it reads only `DATABASE_URL` from the process environment and never
 * a file, so run it where the variable is injected (`railway run bun run admin:grant <id>`, or with the
 * variable set).
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const owner = args.includes('--owner')
  const rest = args.filter((arg) => arg !== '--owner')
  const identifier = rest.join(' ').trim()
  if (!identifier || rest.length !== 1) {
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  const { DATABASE_URL } = loadDatabaseEnv()
  process.exitCode = await runGrantAdmin({
    databaseUrl: DATABASE_URL,
    identifier,
    role: owner ? 'owner' : 'admin',
  })
}

main().catch((error) => {
  console.error('Granting the admin role failed:', error)
  process.exitCode = 1
})
