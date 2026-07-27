---
status: accepted
---

# Own runtime contracts in the schemas package

`@squadzr/schemas` is the single source of truth for external HTTP and WebSocket contracts and exports transport types inferred from its Zod schemas. `@squadzr/types` contains only shared static types that have no runtime representation, while server domain entities remain independent. This preserves the two-package structure and existing wire formats while preventing manually duplicated contract types from drifting.
