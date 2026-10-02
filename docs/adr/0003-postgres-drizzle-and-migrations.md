# ADR 0003 — Relational Postgres with Drizzle and append-only migrations

## Status

Accepted.

## Context

The dashboard needs full-text search, facets (type, tag, date, region, link status), an orphan
view, a connection graph, trash and version history — all relational queries over entries, tags and
connections. A CRDT (Yjs, Automerge) would bundle undo, history and real-time sync, but stores the
board as an opaque blob that SQL cannot query, and real-time collaboration is a non-goal.

## Decision

- **PostgreSQL is the source of truth**, accessed through **Drizzle ORM**. Types flow from the
  Drizzle schema (`packages/db`) through hand-written Zod DTOs (`packages/shared`) to `api` and
  `web`.
- **Full-text search**: the server maintains a plain-text `entries.search_text`; a stored generated
  `tsvector` (`simple` configuration) with a GIN index backs `websearch_to_tsquery`, ranking via
  `ts_rank_cd` and snippets via `ts_headline`.
- **Saving is last-write-wins** per entry. `entry_versions` captures the previous state only when
  content is committed, inside the same transaction, pruned to the newest 20. Multi-row writes
  (tag assignment, frame group-move, user role changes) run in one transaction.
- **Soft delete**: `deleted_at` hides an entry from every read path except the trash.
- **Migrations are append-only SQL files** in `packages/db/migrations`, generated with
  `pnpm db:generate` (drizzle-kit) and then reviewed by hand. Each has a hand-written
  `migrations/down/<name>.down.sql`; `migrate.integration.test.ts` applies up → down → up against a
  real Postgres and checks data-carrying migrations (for example the backfill in `0006_boards`).
- **Who migrates**: in production the one-shot `migrate` compose service runs before `api` and
  `worker` start; outside production the api applies pending migrations on boot.

## Consequences

- A migration that has been released is never edited; schema changes always add a new numbered
  file plus its down file and a test case.
- drizzle-kit output must be read, not trusted: it once generated a text→enum `ALTER COLUMN` without
  a `USING` clause, which fails on any Postgres. Data migrations are written so they are safe on
  existing data.
- Integration tests need Docker (testcontainers) — see [`docs/TESTING.md`](../TESTING.md).
- Concurrent editors on the same entry overwrite each other; there is no merge. This is accepted
  because collaboration is asynchronous by design.
