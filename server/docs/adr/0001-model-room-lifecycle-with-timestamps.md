---
status: accepted
---

# Model the room lifecycle with explicit timestamps

Squadzr stops managing a room when its squad is ready for handoff to Discord, so the speculative `waiting`, `playing`, and `finished` status enum is removed. An open room is represented by a null `readyAt`, becomes ready when `readyAt` is set, and uses `lastActivityAt` to expire after 24 hours without a membership change. A ready room leaves the public catalog immediately, remains accessible to its members for 60 minutes, and is then deleted. The obsolete `status` field is removed from the coordinated HTTP contract.
