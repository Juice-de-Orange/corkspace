# CLAUDE.md — Corkspace

Guidance for coding agents (and humans) working in this repository. Read it before changing code.

## What this is

Corkspace is a self-hosted, infinite pinboard in the spirit of Miro: sticky notes, rich documents,
checklists, images, link cards and YouTube/Vimeo embeds on an explorable canvas, connected by red
threads, with freehand drawing, frames, teleports (saved viewpoints), per-entry public/private
visibility, sharing, a per-board dashboard (search → jump-to flight, trash, versions, graph, export)
and an instance admin page. The canvas engine is custom-built.

- Product description: [`docs/DESIGN.md`](docs/DESIGN.md)
- Architecture decisions: [`docs/adr/`](docs/adr/README.md)
- Test layers and gates: [`docs/TESTING.md`](docs/TESTING.md)
- Running it in production: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Stack

- **Web** (`apps/web`): React 19, Vite, TypeScript (strict), Tailwind v4, `signia` signals,
  TipTap/ProseMirror, DOMPurify, d3-force (graph), html-to-image + jsPDF (export), React Router.
- **API** (`apps/api`): Hono on Node 22, Better Auth (email + password, argon2id), Zod, Drizzle.
- **Worker** (`apps/worker`): Postgres-backed job queue, sharp.
- **Data**: PostgreSQL 16 via Drizzle ORM; assets on a local volume.
- **Tooling**: pnpm 11 workspaces, Turborepo, Biome, knip, Vitest (v8 coverage, Testing Library,
  jsdom), Playwright, testcontainers.
- **Deploy**: Docker Compose (`db`, `migrate`, `api`, `worker`, `web` = nginx).

## Repository layout

```
apps/web          React SPA: canvas, dashboard, /account, /admin, /share/:token
  src/canvas/       runtime (camera reactor, culling, LOD), entries, chrome, input, state
  src/commands/     every mutation as an undoable command (history.execute)
  src/i18n/         typed DE/EN message catalog, t() / useT()
  src/components/ui shared UI primitives (Modal, dialogs, Field, Tabs, Menu, toasts, …)
  e2e/  perf/       Playwright specs; jsdom performance tests
apps/api          Hono app: routes/, services/ (board-access.ts = the access model), middleware/
apps/worker       asset queue + sharp pipeline
packages/engine   pure canvas math (camera, coords, culling, LOD, collision, routing, flight,
                  freehand, grid, minimap, command stack) — imports only @corkspace/shared/kernel
packages/shared   kernel (constants + branded World/Screen types), Zod DTOs, pure domain logic,
                  ./server subpath (safeFetch — server only)
packages/db       Drizzle schema, SQL migrations (+ down/), migrate and reset CLIs, test DB helper
infra             docker-compose.yml, Dockerfiles, nginx.conf
scripts           backup.sh, restore.sh, check-focused-tests.mjs
docs              DESIGN, TESTING, DEPLOYMENT, adr/
.github           CI (verify, e2e + perf, audit, compose build, secret scan), CodeQL
```

Workspace packages are consumed as TypeScript source (`exports` → `./src/*.ts`,
`moduleResolution: "Bundler"`); there are no project references and the libraries have no build
step.

## Commands

Run from the repository root.

| Command | Purpose |
|---|---|
| `pnpm install` | Install (Node ≥ 22, pnpm 11 via `corepack enable`) |
| `pnpm verify` | **The gate.** Focused-test guard, Biome, knip, then typecheck + unit + integration + build in every package. Needs Docker. |
| `pnpm verify:full` | `verify` + `pnpm audit --audit-level=high` + e2e + perf |
| `pnpm typecheck` | `tsc --noEmit` everywhere |
| `pnpm lint` / `pnpm lint:fix` / `pnpm format` | Biome check / safe fixes / format |
| `pnpm knip` | Unused files, exports and dependencies |
| `pnpm test:unit` | Vitest unit tests (engine, shared, web) with coverage gates |
| `pnpm test:integration` | Vitest + testcontainers Postgres (api, worker, db) — Docker |
| `pnpm test:e2e` | Hermetic Playwright run (`apps/web/scripts/e2e.ts`) — Docker + Chromium |
| `pnpm test:perf` | Render-count, culling and LOD assertions on 5 000 entries |
| `pnpm build` | Build api, worker and web |
| `pnpm db:generate` | Generate a migration from the Drizzle schema (review the SQL!) |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:seed-demo` | Fill a running instance with a synthetic demo board (`SEED_URL`, `SEED_EMAIL`, `SEED_PASSWORD`) |

Single package or file:
`pnpm --filter @corkspace/engine test:unit`,
`pnpm --filter @corkspace/engine exec vitest run src/lod/lod.test.ts`,
`pnpm --filter @corkspace/web exec tsx scripts/e2e.ts editor.spec.ts`.

Local development: start a Postgres, export the variables from `.env.example` into your shell
(with `NODE_ENV=development` and a `DATABASE_URL`), then run `pnpm --filter @corkspace/api dev`,
`pnpm --filter @corkspace/worker dev` and `pnpm --filter @corkspace/web dev` (Vite on port 5173
proxies `/api` to port 3000). Outside production the api migrates and seeds the admin on start.

## Architecture rules (invariants)

Breaking one of these is a bug even if the tests still pass.

**Canvas engine**
- `packages/engine` is pure and framework-agnostic. It imports only `@corkspace/shared/kernel` —
  never React, the DOM, `api`, `db`, `web` or the root of `@corkspace/shared`
  (`modularity.guard.test.ts` enforces it). New canvas math goes here, with unit tests first.
- The camera never drives React renders. Pan and zoom update the world transform imperatively from
  the camera signal; the perf suite asserts zero entry re-renders on pan, zoom and the idle re-snap.
  Anything that must follow the camera (outlines, badges, minimap marker) is updated imperatively.
- Exactly one live TipTap editor at a time; mount on edit, serialise and unmount on blur.
- Initial load fetches entry metadata and positions only; bodies load lazily per entry.
- SVG overlays (threads, strokes) must not use `vector-effect`; screen-constant widths use the
  `--px` CSS variable. Floating UI carries `data-ui-chrome`.

**Coordinates**
- World and screen coordinates are different branded types (`packages/shared/src/kernel/coords.ts`).
  Convert only through engine functions (`screenToWorld`, `worldToScreen`, …). Persist world
  coordinates only.
- New entries get `reference size ÷ current zoom` as world size. Product constants live only in
  `packages/shared/src/kernel/constants.ts`.

**Data and migrations**
- Postgres is the source of truth. Types flow Drizzle schema → Zod DTOs in `packages/shared` →
  `api` and `web`; do not duplicate shapes.
- Migrations are **append-only**. Never edit a released migration. Add a new one with
  `pnpm db:generate`, read and fix the generated SQL (e.g. casts need `USING`), add the matching
  `packages/db/migrations/down/<name>.down.sql`, and extend `migrate.integration.test.ts` when data
  is transformed.
- Multi-row writes run in one transaction. Soft-deleted rows (`deleted_at`) are excluded from every
  read path except the trash.

**Access control**
- Authorisation lives on the server, in `apps/api/src/services/board-access.ts`. Every board read
  uses `boardVisibilityWhere(access)`; every mutation includes `board_id = :boardId` and is guarded
  by `requireBoardEditor` (or owner/super-admin guards). Edit rights come from board ownership or
  membership, never from the instance `admin` role.
- Viewers and share links see `public` entries only — including connections and anchored strokes
  that touch a private entry. The `/api/public/:token/*` tree is GET-only.
- Every new route gets an integration test per access level that asserts on the response body.
- Open sign-up stays disabled; accounts are created by administrators.

**Client state**
- No `localStorage`/`sessionStorage`/IndexedDB for board state, selection, undo history or the
  camera (the camera is persisted per user via `/api/me/camera`). `localStorage` is allowed only for
  per-viewer UI preferences (theme, language) with a `corkspace-` key prefix and a try/catch.
- Every mutation is a command run through `history.execute` (undoable). Per-board client singletons
  must be cleared in `resetBoardClientState()`.
- User-action failures roll back and show a toast via `saving()`; never swallow them silently.

**Internationalisation**
- Every user-visible string goes through the typed catalog in `apps/web/src/i18n/messages/`
  (`t()` / `useT()`), with both `en` and `de` — a missing language is a compile error. English is
  the default. Domain labels shared with other packages live in `packages/shared/src/ui-labels.ts`.
  Format dates with the active UI language, not a hard-coded locale.

**Security**
- Any server-side fetch of a user-supplied URL goes through `safeFetch` from
  `@corkspace/shared/server` (https only, every resolved IP public, pinned socket, per-hop redirect
  re-validation, size/time/content-type limits). Never call plain `fetch` on user input in `api` or
  `worker`. The web bundle must never import `@corkspace/shared/server`.
- Uploads: validate by magic bytes and size, store under `ASSET_DIR` with generated names, serve
  only through the API after the entry's visibility check. Remote images are downloaded by the
  worker and served same-origin; never hotlink.
- Rich text is sanitised (ProseMirror schema + DOMPurify). The only iframes are the YouTube/Vimeo
  allowlist in `packages/shared/src/video-embed.ts`; adding a provider means changing the parser,
  its tests and the CSP in `infra/nginx.conf` together.
- Validate every API input with Zod at the boundary (strict schemas reject unknown fields).
- Secrets come only from the environment; keep `.env.example` complete and value-free.

## Conventions

- English for code, comments, commits and docs. UI text in both catalog languages.
- Biome formatting: 2 spaces, single quotes, no semicolons unless needed, trailing commas, 100
  columns. Organised imports.
- Strict TypeScript: no `any`, no `@ts-ignore`; `biome-ignore` only with a written reason.
- Small, named, pure functions where possible; explicit coordinate spaces and visibility checks;
  one way to do a thing.
- Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`), one logical
  change per commit, scoped to an app or package.
- Never commit `.env`, build output, coverage or `node_modules`.
- Never write real credentials, hostnames or personal data into any file; use `.env`.
  Examples use `example.com` and the `203.0.113.0/24` documentation range.

## How to work here

Work in small, gated steps:

1. **Plan the step.** State the goal and an acceptance list (behaviour, tests, docs) before writing
   code. Larger work is split into phases, each of which ends in a shippable state.
2. **Loop per unit of work:** implement → write or extend tests → `pnpm verify` → check against the
   acceptance list → commit. CI runs the same gates on every pull request; keep it green.
3. **Gate each phase.** A phase is done only when every acceptance item holds, `pnpm verify:full`
   is green and the relevant review checklist has no open findings: security (input validation,
   RBAC proven at the API, SSRF, uploads, headers, `pnpm audit`), performance (no camera
   re-renders, culling, LOD, lazy loading, bundle size), data integrity (migrations up/down,
   transactions, soft delete, versions, backups), accessibility (keyboard, labels, contrast, axe,
   reduced motion) and code quality (coverage, Biome, knip, no focused or skipped-to-pass tests).
   Do not start the next phase before the gate passes.
4. **Do not cheat the gates.** Never skip, focus, comment out or delete a test, lower a coverage
   threshold or mock real behaviour away in integration/e2e tests to get green. Fix the code; if a
   test is wrong, fix the test and say why in the pull request.
5. **Decide and record.** Resolve ambiguity with the most reasonable reading of `docs/DESIGN.md`
   and the ADRs, and note the decision in the pull request. A decision that changes architecture
   gets a new ADR in `docs/adr/` (never rewrite an accepted one).
6. **Prove visual claims.** For anything painted on the canvas, use a pixel diff in e2e; DOM counts
   and bounding boxes are not proof that something is visible.
7. **Blocked?** Describe the blocker in the issue or pull request and continue with independent
   work.
