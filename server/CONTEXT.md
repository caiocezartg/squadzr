# Server Context

This context owns the concepts and rules used to form and coordinate squads in rooms.

## Language

**Membership**:
The durable association between a user and a room.
_Avoid_: Presence, connection, viewer

**Presence**:
The transient participation of a member in a room's live experience. A member is online while at least one healthy live session is participating in that room.
_Avoid_: Membership, player

**Room Activity**:
The most recent durable change to a room's membership.
_Avoid_: Presence, connection, view

**Open Room**:
A room that is accepting new memberships while its squad is being formed.
_Avoid_: Waiting room, active room

**Ready Room**:
A room whose squad has reached its required capacity and no longer accepts membership changes.
_Avoid_: Completed room, waiting room
