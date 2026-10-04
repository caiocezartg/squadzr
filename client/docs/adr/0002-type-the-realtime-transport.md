---
status: accepted
---

# Type the realtime transport and own resubscription

The WebSocket transport is the single seam where server frames are parsed and validated against `@squadzr/schemas`: callers register typed handlers and never see a raw payload. The transport owns the connection state machine, exponential backoff with jitter, and the replay of active subscriptions after every reconnect, so callers do not coordinate resubscription.

The lobby consumes the authoritative room snapshot as its only source for the live roster, readiness, Presence and the authorized Discord link; HTTP responses supply static room metadata and never overwrite live state. Incremental events are idempotent, so duplicate events cannot duplicate rooms or members.

A mismatched or unparseable protocol announcement, or a frame that cannot be parsed at all, makes the app show a short notice and reload into the build that matches the server. The automatic reload is bounded to one attempt per tab in a cooldown window; a divergence that repeats inside the window keeps a persistent, accessible notice with a manual reload instead of looping. A message whose envelope parses but whose payload breaks its event contract is rejected at the transport seam without a reload.
