---
status: accepted
---

# Source the catalog from IGDB through a scheduled Catalog Import

The Game Catalog used to be a static seed that identified games by slug and was upserted as part of the deploy. It is replaced by a Catalog Import whose identity is the **IGDB id**: one run fetches every candidate through the Game Catalog Source port, checks that the candidates can sustain today's catalog, and only then upserts, delists and relists games in one transaction.

The safety checks run before any write: candidates must reach a configured fraction of today's Listed Games and an absolute floor that also covers the first run. An explicit override bypasses only the fraction check, never the floor. Rows without an IGDB id are legacy rows: they stay delisted and untouched so Squads that reference them keep rendering, while the import only addresses rows by IGDB id.

The curated squad-size and featured list is injected by the factory and wins over source data, with its maximum clamped to 40 players; otherwise the largest online co-op/online capacity between 2 and 40 becomes the squad size, and anything else falls back to 2–5. The IGDB implementation arrives in CCC-90 and the schedule in CCC-91; the port keeps the import provable against a fake source today and lets the source be swapped without touching the catalog rules.
