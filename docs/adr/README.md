# Architecture decision records

Short records of the decisions a contributor needs to know before changing Corkspace. Each record
has the sections Status, Context, Decision and Consequences. The product itself is described in
[`docs/DESIGN.md`](../DESIGN.md).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-custom-canvas-engine.md) | Custom canvas engine instead of a whiteboard library | Accepted |
| [0002](0002-world-coordinates-and-spatial-index.md) | World coordinates, branded types and a client-side spatial index | Accepted |
| [0003](0003-postgres-drizzle-and-migrations.md) | Relational Postgres with Drizzle and append-only migrations | Accepted |
| [0004](0004-auth-and-board-access.md) | Better Auth with admin-created accounts and a board-scoped access model | Accepted |
| [0005](0005-assets-on-disk-and-worker.md) | Assets on a local volume, processed by a queue worker | Accepted |
| [0006](0006-ssrf-guarded-fetching.md) | Server-side fetching only through an SSRF guard; no arbitrary embeds | Accepted |
| [0007](0007-client-state-and-local-storage.md) | Board state lives on the server; localStorage only for UI preferences | Accepted |

## Adding a record

1. Copy the structure of an existing record into `NNNN-short-title.md` with the next free number.
2. Start with **Status: Proposed**; change it to **Accepted** when the pull request that implements
   it is merged.
3. Never rewrite an accepted record. If a decision changes, add a new record and set the old one to
   **Superseded by ADR NNNN**.
4. Add the record to the table above.
