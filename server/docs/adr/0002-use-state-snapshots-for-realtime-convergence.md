---
status: accepted
---

# Use state snapshots for realtime convergence

PostgreSQL is the source of truth, while WebSocket events are best-effort low-latency hints. Clients receive a complete room snapshot after every connection or reconnection and tolerate duplicate events, so a missed event cannot leave them permanently inconsistent. Persisted notifications use an idempotency key and may be retried. A transactional outbox, message queue, and distributed broker are intentionally deferred while the server remains a single instance.
