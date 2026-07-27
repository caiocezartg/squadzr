# Triage Labels

The engineering skills use five canonical triage roles. This file maps those roles to the labels used in Linear.

| Canonical role    | Linear label      | Meaning                                       |
| ----------------- | ----------------- | --------------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate this issue.      |
| `needs-info`      | `needs-info`      | Waiting on the reporter for more information. |
| `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent.       |
| `ready-for-human` | `ready-for-human` | Requires human implementation.                |
| `wontfix`         | `wontfix`         | Will not be actioned.                         |

## Code-area labels

Apply one or more of these labels to identify the affected part of the codebase:

| Linear label          | Scope                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| `area:frontend`       | React client, routes, components, hooks, and client libraries.                  |
| `area:backend`        | Fastify server, controllers, application use cases, and domain logic.           |
| `area:infrastructure` | Deployment, runtime configuration, external providers, and operational tooling. |
| `area:shared`         | Shared packages, TypeScript types, schemas, and workspace configuration.        |
| `area:database`       | Drizzle, PostgreSQL schema, migrations, queries, and data persistence.          |
| `area:realtime`       | WebSocket behavior, real-time events, and presence-related behavior.            |

Area labels add context; they do not replace or change a triage state. Use Linear's native priority and estimate fields rather than labels for urgency and complexity.
