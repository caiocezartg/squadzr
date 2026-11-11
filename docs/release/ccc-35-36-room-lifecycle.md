# CCC-35 + CCC-36 coordinated release — persisted room lifecycle

- Status: ready for manual execution (automatic gates and smoke checks arrive in CCC-44)
- Owner of the production steps: repository owner (the implementation PR only delivers this checklist)
- Related: CCC-35 (migration), CCC-36 (activity, readiness, expiration, retry), CCC-30 (branch
  protection), CCC-44 (protected automatic deploy and smoke checks)

## Why this is one release

CCC-35 migrates the persisted room lifecycle (renames `completed_at` to `ready_at`, drops
`ready_notified_at`, adds `last_activity_at`, drops the `room_status` enum and column, and adds
`user_notifications.room_id` with a unique idempotency index) and removes `status` from the shared
contracts and the client. CCC-36 then implements the behaviour that reads those columns (activity,
readiness, the two expiration clocks, and `room_ready` retry).

The migration and the removal of `status` are never published on their own:

- **Freeze:** do not open or merge the `development` → `main` promotion pull request until both
  CCC-35 and CCC-36 are merged into `development`. `main` is the only branch Vercel deploys to
  Production (see [`docs/ci/quality-gates.md`](../ci/quality-gates.md)), so the freeze is enforced
  by simply not promoting.
- The coordinated pull request(s) into `development` merge in dependency order: CCC-35 first, then
  CCC-36 rebased on it.

## Environment note (2026-10-02)

The quality-gates record of 2026-09-29 shows no hosted server and no production PostgreSQL: the
Railway project was deleted and Vercel deploys the client from `main`. The production steps below
are the written procedure for the environment restored by CCC-44; until then they can be
rehearsed against a clone/backup, and the user/account/session counts can only be recorded there.
Do not treat the local/test database as production.

## Order of execution

1. Prove branch protection (CCC-30) is active.
2. Back up the database and record user/account/session counts (clone and production).
3. Run the lifecycle migration (it includes the deliberate cleanup).
4. Deploy the server.
5. Deploy the client.
6. Manual smoke checks.
7. Record user/account/session counts again.
8. Roll back only if a check fails (see Rollback).

Database first, then server, then client: the migration drops columns the old server reads, so the
old server cannot keep running against the new schema. The new client tolerates the old server
because Zod strips unknown fields, so the client is the safest last step.

## 1. Prove the protected branches (operator)

```sh
gh api repos/caiocezartg/squadzr/rulesets   # both rulesets listed with "enforcement": "active"
```

Both `development: integration branch` and `main: release-only promotion` must require the six CI
checks (and `promotion-source` on `main`). The CCC-30 demonstration (a failing check blocking a
pull request into `development`, recorded in CCC-30) is the proof to attach to this step. Do not
execute the production migration if either ruleset is inactive.

## 2. Backup and counts (operator)

Run against the production `DATABASE_URL` (and, when rehearsing, against a clone of it):

```sh
pg_dump "$DATABASE_URL" --format=custom --file="squadzr-pre-ccc35-$(date +%Y%m%d%H%M).dump"
```

Record the authentication counts **before** the migration:

```sql
SELECT 'user' AS relation, count(*) AS total FROM "user"
UNION ALL SELECT 'account', count(*) FROM "account"
UNION ALL SELECT 'session', count(*) FROM "session";
```

Record the disposable counts too, so the cleanup can be verified against them:

```sql
SELECT 'rooms' AS relation, count(*) AS total FROM "rooms"
UNION ALL SELECT 'room_members', count(*) FROM "room_members"
UNION ALL SELECT 'room_ready_notifications', count(*) FROM "user_notifications" WHERE type = 'room_ready';
```

## 3. Migration (operator)

Check out the merged CCC-35 commit and run the repository migrator (it applies
`server/drizzle/0003_*.sql` in one transaction):

```sh
cd server && bun run db:migrate
```

The migration deliberately deletes the disposable records and nothing else:

```sql
DELETE FROM "room_members";
DELETE FROM "rooms";
DELETE FROM "user_notifications" WHERE type = 'room_ready';
```

Users, accounts, sessions, and notification history of any other type are untouched. The same file
then renames `completed_at` to `ready_at`, adds non-null `last_activity_at` (default `now()`),
drops `ready_notified_at` and `status`, drops the `room_status` type, adds
`user_notifications.room_id` with the unique index
`user_notifications_room_user_type_unique (room_id, user_id, type)`, and adds the explicit CHECK
constraints `rooms_ready_after_created` (`ready_at IS NULL OR ready_at >= created_at`),
`rooms_last_activity_after_created` (`last_activity_at >= created_at`), and
`rooms_ready_after_last_activity` (`ready_at IS NULL OR ready_at >= last_activity_at`). The
constraints are added after the cleanup, so they validate against an empty `rooms` table.

## 4. Server deploy (operator)

Deploy the same commit that was migrated. Confirm the server answers readiness and that the room
cleanup scheduler starts in the logs (`Room cleanup scheduler started`). The startup compatibility
code `markLegacyFullRooms` no longer exists, so no full-room repair runs at boot.

## 5. Client deploy (operator)

Deploy the client from the same release. The client build no longer carries the room `status`
field in `@squadzr/schemas`, `@squadzr/types`, or the UI (including the landing sample data).

## 6. Manual smoke checks (operator)

- **Readiness:** create a room, join it to capacity; the last join sets `ready_at` to the same
  instant as `last_activity_at`, the `room_ready` notification is created once per member in the
  same transaction, and the room leaves the catalog immediately (no grace window). It stays
  accessible to its members for `ROOM.READY_ROOM_RETENTION_MS` (60 minutes); leaving a ready room
  answers `ROOM_READY` and a late join answers `ROOM_FULL`.
- **Open Room expiration:** an Open Room stops being listed, queryable and joinable at
  `lastActivityAt + ROOM.OPEN_ROOM_TTL_MS` (24h), even before the cleanup scheduler deletes it.
- **Catalog without invite:** `GET /api/rooms` returns the public projection with no
  `discordLink`, no roster, and no `readyAt`/`lastActivityAt`.
- **Member lobby with invite:** `GET /api/rooms/:code` as a member returns `discordLink` and the
  roster; as a non-member it returns only the public projection.
- **Counts again:** rerun the count queries from step 2. `user`, `account`, and `session` must be
  unchanged; `rooms`, `room_members`, and `room_ready` notifications are expected to be zero
  immediately after the migration (rooms created during the smoke test are new).

## Rollback

Rollback limits, in order of preference:

1. **Restore the backup** (full recovery, including the deleted room history):
   `pg_restore --clean --if-exists --dbname "$DATABASE_URL" <dump>`, then redeploy the previous
   server and client revisions.
2. **Schema-only reverse** (room/membership/room_ready notification rows stay deleted — they are
   disposable by product decision; user and auth data is intact). Stop the new server, run the
   reverse SQL below **before** redeploying the previous server revision (that revision expects
   `status`, `completed_at`, and `ready_notified_at`), then redeploy the previous server and
   client revisions:

```sql
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_ready_after_created";
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_last_activity_after_created";
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_ready_after_last_activity";
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'playing', 'finished');
ALTER TABLE "rooms" ADD COLUMN "status" "room_status" DEFAULT 'waiting' NOT NULL;
ALTER TABLE "rooms" RENAME COLUMN "ready_at" TO "completed_at";
ALTER TABLE "rooms" ADD COLUMN "ready_notified_at" timestamp with time zone;
ALTER TABLE "rooms" DROP COLUMN "last_activity_at";
ALTER TABLE "user_notifications" DROP CONSTRAINT "user_notifications_room_user_type_unique";
ALTER TABLE "user_notifications" DROP COLUMN "room_id";
```

After a reverse, remove the migration bookkeeping row so a future `db:migrate` can re-apply 0003:

```sql
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1790993426164; -- 0003 folderMillis
```

Order matters: the reverse SQL (including dropping the CHECK constraints) must run before the
previous server starts; never run the reverse against a database still serving the new server.

## Production cleanup

The production cleanup is the `DELETE` block inside migration 0003 (step 3), limited to
`room_members`, `rooms`, and `user_notifications.type = 'room_ready'`. The pre/post counts in
steps 2 and 6 are the evidence that it reached only those rows and preserved authentication data.
No separate cleanup script needs to run.
