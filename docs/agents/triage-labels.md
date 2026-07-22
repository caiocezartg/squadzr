# Triage Labels

The engineering skills use five canonical triage roles. Each role maps directly
to a Linear label in the Squadzr team.

| Canonical role    | Linear label      | Meaning                                   |
| ----------------- | ----------------- | ----------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate this issue   |
| `needs-info`      | `needs-info`      | Waiting for more information              |
| `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent    |
| `ready-for-human` | `ready-for-human` | Requires human implementation or judgment |
| `wontfix`         | `wontfix`         | Will not be actioned                      |

Use at most one canonical triage label at a time. Replace it when the issue moves
to another triage stage.

## Area labels

Area labels identify the parts of the repository affected by an issue. They are
independent of the triage labels, and more than one may be applied.

| Linear label    | Scope                                                               |
| --------------- | ------------------------------------------------------------------- |
| `area:frontend` | Client application and user interface                               |
| `area:backend`  | Server, API, persistence, authentication, and real-time services    |
| `area:shared`   | Shared schemas, types, and cross-workspace contracts                |
| `area:infra`    | Tooling, configuration, CI/CD, deployment, and operational concerns |

Apply every relevant area label when creating or triaging an issue.
