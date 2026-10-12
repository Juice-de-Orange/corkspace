# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- One-command start: `./setup` writes `infra/.env` with generated secrets and prints the admin
  sign-in; `docker compose up -d` from the repository root (new `compose.yaml`) pulls the GHCR images
  and builds from source when they are not available; `docker compose --profile demo run --rm seed`
  loads the demo board without Node on the host. A release workflow publishes
  `ghcr.io/juice-de-orange/corkspace-{api,worker,web}` for amd64 and arm64 on `v*` tags.
- README: new top (hero GIF, what you get, quick start), an honest comparison with Miro, tldraw,
  Excalidraw and AFFiNE, the AI-assistance note; issue form for questions.
- First public release: infinite canvas with culling and level of detail, five entry types,
  red threads, freehand drawing, frames, teleports, tags, per-user boards with editor/viewer
  invitations and share links, admin area, dashboard with search, graph, trash and version
  history, PNG/PDF export, light/dark/retro themes, touch UI.
- `pnpm db:seed-demo` fills a board with synthetic demo content.
- `BRAND_NAME` sets the name of an instance shown in the header, on the sign-in page, in the
  browser tab and in export file names (default `Corkspace`). The web app reads it from the new
  public `GET /api/instance`.
- README "Known limitations" says what works differently without e-mail, and DEPLOYMENT.md §4 how
  a locked-out administrator gets back in (#10).

### Fixed

- Creating an entry with an `imageAssetId` that does not exist or was uploaded to another board is
  rejected with 400 (it failed with a database error, or attached another board's image) (#5).
- Quick successive edits of the same entry (for example adding a checklist item and ticking it
  right away) could be saved out of order, so a reload showed the older state. Saves of one entry
  are now sent one after another, newest last (#6).
- Text typed into an open document, sticky note or checklist item was lost when the tab was closed,
  reloaded or hidden before the editor lost focus. It is now saved at that moment (with `keepalive`,
  so the request completes after the page is gone); the editor stays open (#9).
- Erasing a stroke right after drawing it, before its save had completed, brought it back once the
  save finished (and the server kept it). It now stays gone and is deleted on the server. Undoing
  an erase and then the drawing also removes the stroke again instead of leaving a copy (#7).
- Quick successive edits of the same entry (for example adding a checklist item and ticking it
  right away) could be saved out of order, so a reload showed the older state. Saves of one entry
  are now sent one after another, newest last (#6).
- Text typed into an open document, sticky note or checklist item was lost when the tab was closed,
  reloaded or hidden before the editor lost focus. It is now saved at that moment (with `keepalive`,
  so the request completes after the page is gone); the editor stays open (#9).
- Erasing a stroke right after drawing it, before its save had completed, brought it back once the
  save finished (and the server kept it). It now stays gone and is deleted on the server. Undoing
  an erase and then the drawing also removes the stroke again instead of leaving a copy (#7).
- Jump-to flights (search results, internal links, teleports) stopped after their first frame when
  the board was idle: the camera reaction set another atom inside signia's reaction cycle, which
  throws. The flag is now set in a microtask; a regression test covers the idle case.

### Changed

- `scripts/backup.sh` and `scripts/restore.sh` find the database, api and worker containers and the
  assets volume through the compose project (including `COMPOSE_PROJECT_NAME` in `infra/.env`)
  instead of assuming `corkspace-*` names; `DB_CONTAINER`, `ASSETS_VOLUME`, `API_CONTAINER` and
  `WORKER_CONTAINER` still override them. The backup now stops if the assets volume does not exist
  instead of archiving a newly created empty one.
- The `web` container runs nginx as the unprivileged user `nginx` (uid 101) instead of root and
  listens on port 8080 inside the container; it now has a healthcheck. `WEB_PORT` on the host is
  unchanged. If a reverse proxy, tunnel or override file points at the container itself (for
  example `web:80` or `127.0.0.1:8080:80`), change the container port to 8080 (#27).
- English is the default UI language; German is picked from a German browser language or the
  toggle.
- Appearance background ids are English (`cork-photo`, `paper`, …); migration `0008` rewrites
  stored values.
- `POSTGRES_PASSWORD` is required by the compose file (no fallback password); the optional
  Cloudflare tunnel service was removed in favour of a generic reverse-proxy setup.
