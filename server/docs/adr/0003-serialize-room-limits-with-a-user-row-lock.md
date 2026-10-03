---
status: accepted
---

# Serialize per-user room limits with a user row lock

The 5-Membership and 3-hosted-Room limits are decided inside the transaction that writes the row, under `SELECT ... FOR UPDATE` on the user row, so concurrent joins by one user into different rooms and concurrent creations by one host serialize instead of both passing the count. The global lock order is room rows first, then the user row: `joinOpenRoom` locks the room and then the user, while `create` locks the user first and only inserts a brand-new room, never waiting for an existing room lock. No transaction waits for an existing room while holding the user lock, so the two paths cannot form a cycle; the pre-transaction count methods are removed so each limit has a single enforcement point.
