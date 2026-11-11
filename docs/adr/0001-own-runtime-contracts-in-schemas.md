---
status: accepted
---

# Own runtime contracts in the schemas package

`@squadzr/schemas` is the single shared package and the single source of truth for external HTTP and WebSocket contracts. It exports transport types inferred from its Zod schemas, and any shared type that has no runtime representation is exported from it as a type export, so no second shared package is needed. Server domain entities remain independent. This keeps one shared package and existing wire formats while preventing manually duplicated contract types from drifting.

Amended in CCC-59: the former `@squadzr/types` package held only static types and had no runtime export, so it was removed and `@squadzr/schemas` became the only shared package.
