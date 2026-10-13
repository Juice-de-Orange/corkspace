# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.2] - 2026-10-13

A patch release for the public demo and for boards on slow or rate-limited connections. No
database migrations.

### Fixed

- Entries in view always get their content when a board opens. Content requests from one render
  go out as one batched `POST …/entries/content` (up to 200 ids) instead of one `GET` per entry; a
  failed request is retried (after `Retry-After`, otherwise with backoff) until the content arrives
  or the entry leaves the view. Before, an entry whose request failed — for example with 429 from
  the demo rate limit — stayed empty until the camera moved. Sticky notes, checklists and documents
  show "Loading…" until their content is there, and cannot be edited before (#67).
- In demo mode, reading entry content is no longer refused while the database is over its size
  cap (#67).
- The demo template build sends a client address, so Better Auth no longer logs "could not
  determine a client IP" on every reset (#68).
- `infra/docker-compose.demo.yml` passes `TRUSTED_PROXIES` and `REAL_IP_HEADER` to `web`, so a
  demo behind Cloudflare or another proxy can key rate limits on the visitor's real address;
  `docs/demo.md` recommends `REAL_IP_HEADER=CF-Connecting-IP` instead of `DEMO_CLIENT_IP_HEADER`,
  which Better Auth ignores (#68).

## [0.1.1] - 2026-10-13

A patch release: start-up, demo and documentation fixes from a first-visitor check of v0.1.0, and
dependency updates. No database migrations.

### Fixed

- `web` waits for a healthy `api` in `infra/docker-compose.yml`. Before, nginx served the sign-in
  page about ten seconds before the api answered, and a first sign-in in that window met 502 (#61).
- The demo seed (`docker compose --profile demo run --rm seed`, and the template board of a public
  demo) starts right of the Places panel and below the toolbar, so the first view of the board shows
  every note uncovered (#61).
- `infra/docker-compose.demo.yml` runs the released GHCR images (`CORKSPACE_VERSION`, default
  `latest`) like a normal instance; `--build` still builds from the checkout (docs/demo.md) (#61).
- README: the quick-start time is measured with the pulled release images (about 1½ minutes);
  building from source is named as the slower case (#61).
- The issue chooser links to GitHub Discussions (#61).

### Changed

- Dependencies: zod 3.25 → 4.6 (#50); vite 6 → 8 with @vitejs/plugin-react 4.7 → 6.1 (#53);
  jsdom 25 → 30 (#51); better-auth 1.7.7, drizzle-orm 0.45.4, hono 4.13.13, pg 8.23.1,
  @node-rs/argon2 2.2.2, @playwright/test 1.64.0, @biomejs/biome 2.5.15, knip 6.41.0 and
  turbo 2.11.7 (#58).

## [0.1.0] - 2026-10-12

### Added

- First public release: infinite canvas with culling and level of detail, five entry types,
  red threads, freehand drawing, frames, teleports, tags, per-user boards with editor/viewer
  invitations and share links, admin area, dashboard with search, graph, trash and version
  history, PNG/PDF export, light/dark/retro themes, touch UI.
- One-command start: `./setup` writes `infra/.env` with generated secrets and prints the admin
  sign-in; `docker compose up -d` from the repository root (new `compose.yaml`) pulls the GHCR images
  and builds from source when they are not available; `docker compose --profile demo run --rm seed`
  loads the demo board without Node on the host. A release workflow publishes
  `ghcr.io/juice-de-orange/corkspace-{api,worker,web}` for amd64 and arm64 on `v*` tags.
- README: new top (hero GIF, what you get, quick start), an honest comparison with Miro, tldraw,
  Excalidraw and AFFiNE, the AI-assistance note; issue form for questions.
- `pnpm db:seed-demo` fills a board with synthetic demo content.
- `BRAND_NAME` sets the name of an instance shown in the header, on the sign-in page, in the
  browser tab and in export file names (default `Corkspace`). The web app reads it from the new
  public `GET /api/instance`.
- README "Known limitations" says what works differently without e-mail, and DEPLOYMENT.md §4 how
  a locked-out administrator gets back in (#10).
- `DEMO_MODE=on` for a public demo (docs/demo.md): every visitor gets a guest account with a private
  copy of a seed board; sign-in, sign-up, password reset, invitations, read links, uploads, link
  previews, feedback and the admin area are refused server-side (`DEMO_DISABLED`); per-address
  request and guest limits, object, body-size and database-size caps; a banner on every page;
  `noindex`. `demo-reset` restores the seed; `infra/docker-compose.demo.yml` runs the demo with an
  hourly reset, resource limits, an api without internet access and one port on `127.0.0.1`.

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
- The sign-in rate limit is kept per client address. Better Auth read `X-Forwarded-For`, which a
  visitor can forge (fresh attempts per forged value), and behind a reverse proxy the chain had two
  entries, so it found no address and all visitors shared one bucket: a few failed sign-ins locked
  everyone out for a few seconds. nginx now resolves the client behind `TRUSTED_PROXIES` from
  `REAL_IP_HEADER` and passes it as `X-Real-IP`, the only header the api uses for this.
- `infra/.env` (database password, auth secret, admin password) was copied into the api, worker
  and migrate images, because `.dockerignore` excluded env files only at the top level. Env files
  are now kept out of the build context everywhere. Images built before contain the file: rebuild
  them and delete the old ones (`docker image prune`), and treat the secrets as exposed if such an
  image ever left the host.
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
