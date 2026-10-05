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
