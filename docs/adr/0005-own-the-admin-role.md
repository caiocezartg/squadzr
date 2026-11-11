---
status: accepted
---

# Own the admin role instead of installing the Better Auth admin plugin

The admin panel (#116) needs one fact about a person, what role they hold, and a handful of operations around it: grant it with a script, change it from the panel, refuse everyone else at every `/api/admin/*` route. We decided to own that role: the `user` table gains a `role` column (`'user' | 'moderator' | 'admin' | 'owner'`, default `'user'`, not null), declared to Better Auth through the core `user.additionalFields` option with `input: false`, and the session contract in `@squadzr/schemas` carries it as a required field. The Better Auth admin plugin is not installed.

## Why not the plugin

The plugin would give us the column and some roles for free, but it also mounts its own endpoints (`/api/auth/admin/*`: list users, set role, ban, impersonate, create or remove users). Those endpoints answer outside `@squadzr/schemas`, so the contracts ADR 0001 makes the single source of truth would no longer hold for them, and they bypass the use-case layer where our rules live: nobody can change their own role or the owner's, an admin cannot touch another admin, every change writes an Audit Entry in the same transaction. Using the plugin would mean restricting, disabling and watching each of those endpoints to keep them from reaching around our rules, which is more work and a bigger standing risk than writing the one use case we need.

## Trade-off

We write and test the small amount the plugin would have given us: the column, the guard, the grant script and (in the later tickets) the role change use case. In exchange the admin surface has exactly the routes we declare, each one validated by a shared schema, guarded in one place and audited.

## Amendment (2026-11-05): moderator, admin and owner

Testing the panel (#125) showed that one `admin` value was too coarse, so the role has four values, set by the product owner in the #116 decision comment:

| Role        | Panel                               | Role changes                                                                                        |
| ----------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `owner`     | Everything                          | Anyone else among `user`, `moderator`, `admin`; nobody changes the owner                            |
| `admin`     | Everything                          | `user` and `moderator` accounts to `user`, `moderator` or `admin`; not another admin, not the owner |
| `moderator` | Overview, Users (read only), Squads | None                                                                                                |
| `user`      | None                                | None                                                                                                |

`owner` is made only by `admin:grant --owner` and the database allows at most one (a partial unique index on the `owner` value), so no UI or API path can mint one; the "at least one admin" rule became "the owner is never changed" and `LAST_ADMIN` was removed. The `/api/admin` scope admits moderator, admin and owner; the admin-only routes add a per-route check. The rules live in one domain function (`decideRoleChange`) and the permission helpers (`canAccessAdminPanel`, `hasFullAdminAccess`, `grantableRoles`) live in `@squadzr/schemas`, so the client and the server read the same table.

If the Better Auth admin plugin is adopted later (for impersonation, say), it is installed with custom roles: `createAccessControl` statements for the four roles, passed as `roles` to the plugin on the server and to the `adminClient` on the client, and `adminRoles` set to `['admin', 'owner']`. The column and the `user` and `admin` values already match the plugin's, and the extra values need no data migration; the plugin's own endpoints would still have to be kept from reaching around the use-case rules above.

## Consequences

The column name and the `user` and `admin` values (`role`, `user` and `admin`) are the ones the plugin uses, so it can still be added later, for example for impersonation, without a data migration. Session cookie caching stays off, so a role change applies on the person's next request. The `admin:grant` script is the only way to the first admin and to the owner, and no sign-up or profile update can set the role.
