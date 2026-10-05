# Context Map

## Contexts

- [Server](./server/CONTEXT.md) — owns the rules for Squads, membership, and live presence
- [Client](./client/CONTEXT.md) — the views players use to find, join and follow Squads

## Relationships

- **Server → Client**: the Client presents the Server's Squads, Memberships and Presence; it adds view terms (Squad Board, Lobby, My Squads) but no new domain rules.
