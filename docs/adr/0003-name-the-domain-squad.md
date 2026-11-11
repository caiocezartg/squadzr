---
status: accepted
---

# Name the domain entity Squad, not Room

The product has always shown players "squads" while the code, contracts, API and database called the same thing a Room, which left two names for one concept and let "lobby" drift into meaning both the single-Squad view and the public list. We decided that Squad is the canonical term everywhere: it is the group being formed and the place it is formed in, the public list is the Squad Board, and the single-Squad view is the Lobby.

## Consequences

The glossaries already use the new language, but the code still says Room. The rename runs in phases (client, shared contracts, server, HTTP API, database), keeping the old `/api/rooms` endpoints and redirecting `/rooms/CODE` links for a transition period, so links players already shared keep working. Until a layer is migrated, read Room in that layer as Squad.
