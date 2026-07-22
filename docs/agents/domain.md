# Domain Docs

This repository uses a multi-context domain-documentation layout.

## Before exploring

Read `CONTEXT-MAP.md` at the repository root when it exists. It maps work to the
relevant context documentation:

- `client/CONTEXT.md` for frontend behavior and user-facing concepts
- `server/CONTEXT.md` for backend domain and application behavior
- `packages/CONTEXT.md` for shared schemas, types, and contracts

Also read relevant architectural decision records:

- `docs/adr/` for system-wide decisions
- `client/docs/adr/` for client-specific decisions
- `server/docs/adr/` for server-specific decisions
- `packages/docs/adr/` for shared-contract decisions

If any of these files or directories do not exist, proceed silently. The
domain-modeling workflow creates them lazily when terminology or architectural
decisions are resolved.

## Expected layout

    /
    |-- CONTEXT-MAP.md
    |-- docs/adr/
    |-- client/
    |   |-- CONTEXT.md
    |   `-- docs/adr/
    |-- server/
    |   |-- CONTEXT.md
    |   `-- docs/adr/
    `-- packages/
        |-- CONTEXT.md
        `-- docs/adr/

## Use the glossary vocabulary

When naming a domain concept in issues, proposals, tests, or code, use the term
defined by the relevant `CONTEXT.md`. Do not replace established terms with
synonyms that the glossary excludes.

If a required concept is absent, reconsider whether new terminology is needed
or record the gap for the domain-modeling workflow.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly
instead of silently overriding the decision.
