# Testing

Corkspace is verified in layers. Every layer runs from the repository root through
[Turborepo](https://turbo.build/), which fans a script out to every workspace package that defines
it. All commands below are real `package.json` scripts.

## Prerequisites

- Node ≥ 22 and pnpm 11 (`corepack enable`), then `pnpm install`.
- **Docker** for the integration and end-to-end layers: they start a throwaway
  `postgres:16-alpine` container through [testcontainers](https://testcontainers.com/). Nothing
  else (no local Postgres, no `.env`) is needed — the tests configure their own environment.
- For end-to-end tests, a Playwright browser:
  `pnpm --filter @corkspace/web exec playwright install chromium`.

Lint, typecheck, unit and perf tests run with Node and pnpm alone.

## The two gates

| Command | What it runs | When |
|---|---|---|
| `pnpm verify` | focused-test guard → `biome check .` → `knip` → `typecheck`, `test:unit`, `test:integration`, `build` in every package | Before every commit / pull request |
| `pnpm verify:full` | `verify` → `verify:security` → `test:e2e`, `test:perf` | Before a release or a larger merge |

`pnpm verify` needs Docker because it includes the integration tests. Both gates stop at the first
failure.

## Layers

### Static checks

| Command | Tool | Notes |
|---|---|---|
| `pnpm lint` | Biome | Lint and format check. `pnpm lint:fix` applies safe fixes, `pnpm format` formats. |
| `pnpm typecheck` | `tsc --noEmit` per package | Strict TypeScript, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. |
| `pnpm knip` | knip | Fails on unused files, exports and dependencies. |
| `pnpm check:focused` | `scripts/check-focused-tests.mjs` | Fails if a `describe.only` / `it.only` / `test.only` / `bench.only`, `fdescribe(` or `fit(` is left in a `*.test.ts(x)` or `*.spec.ts(x)` file. `.skip` is allowed because Playwright's conditional `test.skip(condition, reason)` is legitimate. |
| `pnpm verify:security` | `pnpm audit --audit-level=high` | Fails on high or critical advisories. The only ignored advisories are listed with their reason in `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`; test-only dependencies that never reach the production image). |

### Unit tests — `pnpm test:unit`

Vitest with v8 coverage, in three packages:

- **`packages/engine`** — all canvas math: world↔screen conversion, zoom-to-cursor, pan, fit-to-rect,
  create-size, LOD buckets and hysteresis, rbush culling, collision AABB, connection routing, stroke
  outlines, shape paths, grid cross-fade, minimap projection, flight tween, seeded random tilt and
  the undo/redo command stack. `modularity.guard.test.ts` fails if the engine imports anything but
  `@corkspace/shared/kernel`.
- **`packages/shared`** — Zod DTOs, settings merge, search-parameter normalisation, graph shaping,
  link-preview parsing, the video-embed allowlist, the image magic-byte sniffer, the IP classifier
  and `safeFetch` (with injected resolver and transport — adversarial SSRF cases, no network).
- **`apps/web`** (jsdom + Testing Library) — the i18n catalog (both languages present, no duplicate
  keys, interpolation), UI primitives (modal, dialogs, field), the overlay layers (no
  `vector-effect` in the SVG overlays), pointer-input math, the canvas runtime's idle re-snap, the
  `saving()` rollback contract, board-switch reset and stores.

### Integration tests — `pnpm test:integration`

Vitest against a real Postgres (testcontainers, all migrations applied), in three packages:

- **`apps/api`** — every route through the real Hono app and Better Auth: sign-in, disabled
  sign-up, admin user management and its last-admin/self guards, entries CRUD, lazy content,
  saving and version capture/prune/restore, soft delete and trash, dashboard search and facets,
  stats, orphans and graph, tags, frames (atomic group move), teleports, strokes, connections,
  assets (magic-byte validation, visibility on serve), link previews (SSRF degradation), feedback,
  camera, and the **board RBAC matrix** (`board-rbac.integration.test.ts`): owner, editor, viewer,
  share link and administrator, asserting on response bodies that no private data leaks.
- **`apps/worker`** — the asset queue and sharp pipeline: variants are produced, an SSRF-blocked
  remote URL ends as `failed`.
- **`packages/db`** — migrations up → down → up (every migration has a hand-written down file), the
  data backfill of `0006_boards`, and the guarded content reset.

Each test file boots its own container; the first run pulls the Postgres image.

### End-to-end tests — `pnpm test:e2e`

Playwright, driven by `apps/web/scripts/e2e.ts`, which is fully hermetic:

1. starts an ephemeral Postgres,
2. starts the real api (it migrates and seeds the admin outside production) and the worker,
3. creates a viewer account and makes it a viewer member of the admin's board,
4. runs Playwright, whose `webServer` builds the SPA and serves it with `vite preview`, proxying
   `/api` to the test api,
5. tears everything down.

Projects: `desktop-chrome` and `mobile-chrome` (Pixel 5 emulation). Specs in `apps/web/e2e/` cover
auth and redirects, canvas navigation and camera restore, every entry type (create, edit, reload
persists), the document editor, drawing and threads (with **pixel-diff** assertions — DOM counts and
bounding boxes pass even when nothing is painted), the dashboard (search → jump-to, trash, versions,
graph, export, tags), viewer read-only mode, appearance settings, the language toggle, feedback and
an axe accessibility scan (zero critical violations on the login page and the board).

Run a single spec or repeat it to hunt flakiness — extra arguments are passed to Playwright:

```bash
pnpm --filter @corkspace/web exec tsx scripts/e2e.ts editor.spec.ts --repeat-each=5
```

The suite runs serially (`workers: 1`) because all tests share one admin and one server-persisted
camera; Playwright retries a failing test up to twice.

### Performance tests — `pnpm test:perf`

Deterministic jsdom tests in `apps/web/perf/` (separate Vitest config) on a board of 5 000 entries:

- `render-count.perf.test.tsx` — pan, zoom-in and the idle re-snap frame cause **zero** entry
  re-renders;
- `culling.perf.test.tsx` — only the viewport plus the overscan ring is mounted, the ring is hidden;
- `lod.perf.test.tsx` — LOD swaps happen at the thresholds and re-register the live DOM node.

Frame rate and memory are not measured automatically.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

| Job | Runs |
|---|---|
| `verify` | `pnpm verify` (testcontainers use the runner's Docker) |
| `e2e + perf` | installs Chromium, then `pnpm test:e2e` and `pnpm test:perf` |
| `dependency audit` | `pnpm audit --audit-level=high` |
| `compose build` | checks that Compose refuses an empty `POSTGRES_PASSWORD`, then builds all images |
| `Secret scan (gitleaks)` | gitleaks over the full history |

`.github/workflows/codeql.yml` adds CodeQL analysis for the TypeScript code and the workflow files.
Locally, `.pre-commit-config.yaml` runs the same gitleaks version as a pre-commit hook
(`pre-commit install`).

## Coverage gates

Thresholds live in each package's `vitest.config.ts` and fail the run when not met.

| Package | Run | Lines | Statements | Functions | Branches |
|---|---|---|---|---|---|
| `packages/engine` | unit | 90 | 90 | 90 | 90 |
| `packages/shared` | unit | 90 | 90 | 90 | 90 |
| `apps/api` | integration | 85 | 85 | 85 | 85 |
| `packages/db` | integration | 90 | 90 | 90 | 90 |
| `apps/worker` | integration | 88 | 88 | 95 | 75 |
| `apps/web` | unit | 5 | 5 | 38 | 48 |

The web app is tested end-to-end first; its unit threshold is a ratchet against regressions, not a
target, and should only ever go up. Process entry points (`src/index.ts`, CLIs), the Node HTTPS
transport and declarative schema files are excluded.

## Running a subset

```bash
pnpm --filter @corkspace/engine test:unit                              # one package
pnpm --filter @corkspace/engine exec vitest run src/lod/lod.test.ts    # one file
pnpm --filter @corkspace/api test:integration                          # api against Postgres
pnpm --filter @corkspace/web test:perf
```

## Conventions

- **Engine and shared logic are written test-first.** They are pure and define correctness for the
  rest of the app.
- **Never weaken a gate to get green.** Do not skip, focus, comment out or delete a test, lower a
  threshold, silence a type error with `any` / `@ts-ignore`, or replace real behaviour with a mock
  in an integration or e2e test. If a test is wrong, fix it and explain why in the pull request.
- **Authorisation is proven at the API**, not in the UI: new routes get integration tests that call
  them with each access level and assert on the response body.
- **Visibility needs pixels.** A claim that something is drawn on the canvas needs a screenshot
  diff of the region before and after.
- **SQL is tested against Postgres**, not against a re-implementation of the query in TypeScript.
- **e2e tests share one board.** A spec whose assertions depend on counts cleans up what it
  creates (see `drawing.spec.ts`, which deletes its strokes and threads via the API in
  `afterEach`). Specs locate controls by role and accessible name, so a changed UI string can
  require a spec update.
- Mobile-only or desktop-only cases use `test.skip(testInfo.project.name.startsWith('mobile'), reason)`
  with a reason.
