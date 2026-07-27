# Domain Docs

How engineering skills should consume this monorepo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT-MAP.md` at the repository root. It points to the relevant context-specific `CONTEXT.md` files.
- The applicable context document:
  - `client/CONTEXT.md` for client work.
  - `server/CONTEXT.md` for server work.
  - `packages/CONTEXT.md` for shared-package work.
- `docs/adr/` for system-wide architecture decisions.
- The relevant context's `docs/adr/` directory for context-specific decisions.

If any of these files do not exist, proceed silently. Do not create them pre-emptively; create or update them only when domain terminology or a technical decision is actually resolved.

## File structure

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                 ← system-wide decisions
├── client/
│   ├── CONTEXT.md
│   └── docs/adr/             ← client-specific decisions
├── server/
│   ├── CONTEXT.md
│   └── docs/adr/             ← server-specific decisions
└── packages/
    ├── CONTEXT.md
    └── docs/adr/             ← shared-package decisions
```

## Use the glossary's vocabulary

When an issue, proposal, hypothesis, test, or implementation names a domain concept, use the term defined in the applicable `CONTEXT.md`. Do not substitute a synonym the glossary explicitly avoids.

If a required concept is not documented, reconsider whether the project already uses another term. If it is a genuine gap, note it for domain-modeling work.

## Flag ADR conflicts

If planned work contradicts an existing ADR, surface that conflict explicitly instead of silently overriding it.
