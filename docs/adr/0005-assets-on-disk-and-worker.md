# ADR 0005 — Assets on a local volume, processed by a queue worker

## Status

Accepted.

## Context

Boards contain uploaded, pasted and dropped images (including animated GIFs), images fetched from a
URL, and preview images of link cards. Images must be safe to serve, small enough to render at low
zoom, and must not slow down the API request that created them. The target deployment is a single
Docker host, not a cloud object store.

## Decision

- **Storage**: originals and derived files live on a Docker volume under `ASSET_DIR`
  (`/data/assets` in compose), in one directory per asset id with generated file names. Postgres
  stores only metadata in `assets` (mime, size, dimensions, `variants` map, `processing_status`).
- **Upload validation** in the API: size cap of 10 MB, MIME type confirmed by magic bytes
  (`sniffImageMime`), stored outside the web root, never executed. Bytes of a `failed` asset are
  never served.
- **Queue in Postgres**: the `worker` service claims the oldest `pending` asset with
  `SELECT … FOR UPDATE SKIP LOCKED`, so several workers could run without double work and no extra
  queue infrastructure is needed.
- **Processing with sharp**: a `full` WebP capped at 800 px on the long edge plus 64, 128, 256 and
  512 px variants; animated GIFs are decoded with `{ animated: true }` so the WebP keeps its frames.
  Failures mark the asset `failed`.
- **Remote images** (image-by-URL and the OpenGraph image of a link card) go through the same queue:
  the API records the source URL, the worker downloads it with the SSRF guard
  ([ADR 0006](0006-ssrf-guarded-fetching.md)). Link cards reference the local asset, never the
  remote URL.
- **Serving**: the API serves bytes at `/api/assets/:id` (and `/api/public/:token/assets/:id`) after
  the same visibility check as the owning entry.

## Consequences

- Backups must cover two things: the Postgres dump and the assets volume (`scripts/backup.sh` does
  both).
- The CSP can be `img-src 'self' data:` — no third-party image hosts, no hotlink tracking.
- The client currently always loads the `full` variant; choosing a variant by on-screen size is an
  open optimisation.
- Moving to object storage later means replacing `apps/api/src/services/asset-storage.ts` and the
  worker's file I/O; the database model does not change.
