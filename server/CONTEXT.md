# Server Context

This context owns the concepts and rules used to form and coordinate Squads.

## Language

**Squad**:
A group being formed for a multiplayer match, with a fixed capacity, a code to join it and, once Ready, a Discord invite for its members.
_Avoid_: Room, party, premade, lobby

**Membership**:
The durable association between a user and a Squad.
_Avoid_: Presence, connection, viewer

**Presence**:
The transient participation of a member in a Squad's live experience. A member is online while at least one healthy live session is participating in that Squad.
_Avoid_: Membership, player

**Squad Activity**:
The most recent durable change to a Squad's membership.
_Avoid_: Room Activity, Presence, connection, view

**Open Squad**:
A Squad that is accepting new memberships while it is being formed.
_Avoid_: Open Room, waiting room, active room

**Ready Squad**:
A Squad that has reached its required capacity and no longer accepts membership changes.
_Avoid_: Ready Room, completed room, waiting room

**Game**:
A multiplayer title in the Game Catalog that a Squad can be formed for. Its squad size and featured placement follow the Catalog Import's curated rules, not the raw source data.
_Avoid_: Title, product, game entry

**Game Catalog**:
The set of Games Squads can be formed for, brought in line by the Catalog Import instead of a static seed. A Game is identified by its IGDB id.
_Avoid_: Game list, games table, catalog list

**Listed Game**:
A Game that appears in the Game Catalog and can be chosen when forming a Squad. A delisted Game keeps its row so existing Squads still render, but the Catalog Import does not count it as today's catalog and only the Catalog Import relists it.
_Avoid_: Active game, visible game, enabled game

**Featured Game**:
A Listed Game the curated list highlights, ordered by its featured rank.
_Avoid_: Highlight, promoted game, top game

**Catalog Import**:
One run that brings the Game Catalog in line with the candidates of a Game Catalog Source: it upserts, delists and relists Games, applies the curated squad sizes and featured ranks, and changes nothing when a safety check or a write fails.
_Avoid_: Seed, sync job, IGDB import
