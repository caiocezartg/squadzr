---
status: accepted
---

# Own the admin role instead of installing the Better Auth admin plugin

The admin panel (#116) needs one fact about a person, whether they are an administrator, and a handful of operations around it: grant it with a script, change it from the panel, refuse everyone else at every `/api/admin/*` route. We decided to own that role: the `user` table gains a `role` column (`'user' | 'admin'`, default `'user'`, not null), declared to Better Auth through the core `user.additionalFields` option with `input: false`, and the session contract in `@squadzr/schemas` carries it as a required field. The Better Auth admin plugin is not installed.

## Why not the plugin

The plugin would give us the column and some roles for free, but it also mounts its own endpoints (`/api/auth/admin/*`: list users, set role, ban, impersonate, create or remove users). Those endpoints answer outside `@squadzr/schemas`, so the contracts ADR 0001 makes the single source of truth would no longer hold for them, and they bypass the use-case layer where our rules live: nobody can change their own role, the last admin cannot be demoted, every change writes an Audit Entry in the same transaction. Using the plugin would mean restricting, disabling and watching each of those endpoints to keep them from reaching around our rules, which is more work and a bigger standing risk than writing the one use case we need.

## Trade-off

We write and test the small amount the plugin would have given us: the column, the guard, the grant script and (in the later tickets) the role change use case. In exchange the admin surface has exactly the routes we declare, each one validated by a shared schema, guarded in one place and audited.

## Consequences

The column name and the values (`role`, `user` and `admin`) are the ones the plugin uses, so it can still be added later, for example for impersonation, without a data migration. Session cookie caching stays off, so a role change applies on the person's next request. The `admin:grant` script is the only way to the first admin, and no sign-up or profile update can set the role.
