# Client Context

The web app where players find Squads, join them and follow them live. It presents the Server context's Squads through views and reuses its language (Squad, Membership, Presence, Open Squad, Ready Squad).

## Language

**Squad Board**:
The public board of Open Squads that a player can browse and join.
_Avoid_: Catalog, lobby, room list, room browser

**Lobby**:
The live view of a single Squad for its members: who is in it, their Presence and, once the Squad is Ready, its Discord invite. A signed-in player who is not in the Squad sees its non-member view instead: the cover, the counter, a preview of its members and its open slots, and the invite locked, with a way to join. That view has no Presence and no live channel, and a visitor sees only a sign-in prompt.
_Avoid_: Squad Board, room page, waiting room

**My Squads**:
The view of the Squads a player hosts or holds a Membership in, including Ready Squads during their retention.
_Avoid_: My Rooms, dashboard, my lobbies
