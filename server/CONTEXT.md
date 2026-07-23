# Server

The Server context owns the domain language and application behavior used to form and manage Squads.

## Language

**Squad**:
A persistent gathering space in which users assemble a group to play together, regardless of its current capacity or readiness.
_Avoid_: Room, Sala

**Squad Owner**:
The member responsible for a Squad throughout its lifetime. If the Owner ends their Membership before readiness, the Squad ends for every member.
_Avoid_: Host, Creator

**Recruiting Squad**:
A publicly discoverable Squad that still accepts Memberships. It becomes Ready when its final available Membership is filled, or ends after 60 minutes without a Membership change; Presence does not extend its lifetime.
_Avoid_: Waiting Room, Playing Squad

**Ready Squad**:
A Squad that has reached its maximum Membership capacity. Its Memberships are frozen, it is no longer publicly discoverable, and it remains accessible to members for 60 minutes before ending; only its members may access its Discord invitation, while member Presence may continue to change during that time.
_Avoid_: Completed Room, Full Room, Finished Squad

**Ready Notification**:
A durable notice owed to every member when their Squad becomes Ready. Delivery may be delayed, but the notice and its Discord invitation must not be lost or shown more than once for the same readiness transition.
_Avoid_: Best-effort alert

**Membership**:
The persistent association stating that a user belongs to a Squad. A user may hold only one Membership across Recruiting and Ready Squads; it survives disconnection and ends when the user leaves before readiness or when the Squad itself ends.
_Avoid_: Presence

**Squad Roster**:
The member-only set of current Memberships in a Squad, regardless of member Presence. A member may be shown as Online when Presence exists, but disconnection does not remove them from the Roster; public discovery exposes only aggregate capacity.
_Avoid_: Online users, Connected players

**Presence**:
The ephemeral state indicating that a member has one or more active connections to a specific Squad. Multiple connections still represent one Presence; Membership is required for Presence, while Presence never creates, removes, or determines the readiness of Memberships.
_Avoid_: Global online status, Membership
