# Corkspace — design

Corkspace is a self-hosted, infinite pinboard in the spirit of Miro: sticky notes, rich documents,
checklists, images, link cards and video embeds live on an explorable canvas, tied together with
red threads, freehand drawing, frames and saved viewpoints. Every entry has a real position on the
board, so nothing ever gets lost — exploring the board should feel like exploring a place: warm,
tactile, with cork and paper textures and a Majorelle-blue accent (`#6050DC`).

This document describes what the product does and why it is shaped that way. Where the original
specification and the code differ, **the code wins**, and the difference is called out. The
architecture decisions behind it are in [`docs/adr/`](adr/README.md).

## 1. Product principles

- **Spatial first.** Everything is placed at world coordinates on one truly infinite plane. Search,
  dashboards and bookmarks always lead back to a place on the board ("jump-to").
- **Smooth at scale.** Thousands of entries — including rich documents — must pan and zoom without
  stutter. The canvas engine is built for that (see [ADR 0001](adr/0001-custom-canvas-engine.md)).
- **Data stays queryable.** The board lives in relational Postgres tables, not in an opaque
  document blob, so full-text search, filters, the orphan view and the connection graph are plain
  SQL.
- **Nothing is lost silently.** Autosave, undo/redo, a trash, per-entry version history and server
  backups. A failing image, embed or link preview degrades to a placeholder; it never breaks the
  board.
- **Private by default.** Login is required, accounts are created by an administrator, and every
  entry is `private` until marked `public`.

## 2. Entry types

| Type | What it is | Reference size at zoom 1.0 |
|---|---|---|
| `sticky` | Short coloured note (yellow, pink, blue, green, orange, purple) | 240 × 240 |
| `doc` | Rich-text document (TipTap/ProseMirror) | 400 × 520 |
| `checklist` | List of checkable items | 320 × 420 |
| `image` | Uploaded, pasted or dropped image, including animated GIFs | natural size, long edge capped at 800 px |
| `link` | Link card with title, description and a locally stored preview image; YouTube and Vimeo URLs render as an embedded player | 320 × 120 |

Common behaviour:

- A new entry gets a slight random tilt (up to ±4°), can be resized at its corners, dragged
  (a press below a 4 px threshold stays a click), duplicated (Ctrl/Cmd+C, Ctrl/Cmd+V) and sent to
  the front or back. The last-clicked entry renders on top; there is no layer panel.
- Selection is single-entry.
- Overlapping entries (1 px AABB intersection) get a yellow outline until they are moved apart.
- Every entry has a `visibility` of `private` or `public` (see §8).
- Deleting moves an entry to the trash (soft delete); it can be restored from the dashboard.

**Documents** support bold, italic, underline, strikethrough, headings, bullet and ordered lists,
task lists, text colour, highlight, links, tables, code blocks and block quotes, with Markdown
shortcuts in addition to a toolbar. A document can use plain, lined or squared paper, insert the
current date and time, embed an inline link preview, and contain internal links (`entry:<uuid>`)
that fly the camera to another entry without drawing a thread. The curated fonts are Source Serif 4
(serif), Inter (sans), JetBrains Mono (mono) and Caveat (handwriting).

**Video embeds** are deliberately narrow: only YouTube (rendered via `youtube-nocookie.com`) and
Vimeo URLs become a sandboxed iframe; every other URL is an ordinary link card.

## 3. World coordinates ("GPS")

- Every entry, frame, stroke and teleport is stored in **world coordinates** (`x`, `y`, `width`,
  `height` in world units, plus `rotation`). Screen coordinates exist only in the browser and are
  converted at well-defined, pure, unit-tested boundaries in `packages/engine`
  ([ADR 0002](adr/0002-world-coordinates-and-spatial-index.md)).
- The current camera position is shown unobtrusively in a corner (position readout).
- **Size rule.** A new entry is created so it looks normal on screen at the *current* zoom: its
  world size is `reference size ÷ current zoom`. After that it keeps that world size and scales with
  the camera like everything else. Entries therefore have no common real size — one created while
  zoomed far out is physically larger than one created up close. The same rule makes drawing
  strokes pen-sized on screen at any zoom.

## 4. Camera and navigation

- The camera is `{ x, y, zoom }` with zoom bounds **0.02× to 8×** (default 1.0) — far enough to
  give a "galaxy" overview.
- Mouse wheel zooms toward the cursor; dragging empty board space pans; arrow keys pan.
- Touch: one-finger pan on empty space, pinch to zoom, two-finger pan, drag to move entries. On
  touch screens a pencil badge on the selected entry opens it for editing, selection handles grow to
  touch size and the create toolbar docks to the bottom of the screen.
- On load the camera returns to where the user last was. The camera is stored **per user on the
  server** (`GET/PUT /api/me/camera`), not in the browser.
- **Jump-to flight.** Search results, orphans, graph nodes, minimap clicks and teleports animate
  the camera with a zoom-out → travel → zoom-in flight (van Wijk–style) whose duration scales with
  distance. `prefers-reduced-motion` shortens it.
- **Minimap** (toggleable) shows entries, frames, threads and the current viewport; clicking it
  flies there.
- **Teleports** are named viewpoints `{ name, x, y, zoom }` listed in a panel; clicking one flies
  there.

*Spec vs. code:* the specification also asked for arrow keys to move the selected entry, for
teleports to appear as clickable buttons placed on the board (the data model has
`is_board_button`, `board_x`, `board_y`), for a built-in "home" teleport to the origin, and for
Figma-style alignment guides with optional grid snapping. None of these are implemented yet.

## 5. Rendering, culling and level of detail

- A world container carries one CSS `translate(…) scale(…)` transform. Pan and zoom write that
  transform imperatively from a signal on each animation frame; **the React entry tree never
  re-renders on camera movement**.
- While a gesture is running the translate is written at full precision; once the camera has been
  still for a short moment it is snapped to the device-pixel grid for crisp text.
- All entry bounding boxes live in an **rbush** R-tree. Each frame the visible set (viewport plus an
  overscan ring of 500 screen px) is queried; entries outside it are hidden or unmounted.
- **Level of detail** by the on-screen length of an entry's longer edge: ≥ 200 px → full content;
  36–200 px → preview; < 36 px → coloured block with no content mounted. Bucket changes use a 12 %
  hysteresis band so entries do not flicker at a threshold.
- **Lazy content.** The initial board load fetches only metadata and positions for all entries;
  document bodies and checklist items are fetched when an entry is mounted or opened.
- Exactly **one** live rich-text editor exists at a time: double-click (or the touch edit badge)
  mounts TipTap, blur serialises the document and unmounts the editor.
- Threads and strokes are SVG overlays inside the world container; their widths are kept
  screen-constant with a `--px` (= 1/zoom) CSS variable.

*Spec vs. code:* the preview tier is computed by the engine, but the web app currently renders
"full" for both the full and preview buckets (no static snapshot yet). Images always load the
capped `full` variant although the worker also produces 64/128/256/512 px variants. The SVG overlay
layers are not viewport-culled yet.

## 6. Red threads, drawing, tags and frames

**Red threads (connections)** link exactly two entries; an entry can have any number of them. A
thread docks to the nearest edge of each entry, is drawn as a smooth Bézier curve with a slight
yarn-like sag, follows its endpoints when they move, and can carry an optional label at its
midpoint and an optional arrowhead at either or both ends. Colour is selectable, red by default.
To create one, hover an entry edge, click (or press and drag) to dock, then click or release on the
target entry. A selected thread is deleted with Delete/Backspace.

**Drawing** uses vector strokes (perfect-freehand outlines) with pen, marker, line, arrow,
rectangle and eraser tools, colours and widths. Strokes can be drawn anywhere: a stroke that starts
on an entry is anchored to it (stored in entry-local coordinates, so it moves and rotates with the
entry); otherwise it belongs to the board layer. Stroke bounding boxes are computed on the server
from the points, never trusted from the client.

**Tags** are a per-board list with colours. They show as chips on entries and can restyle an entry
through rules (by default a tag gives the entry a border in its colour).

**Frames** are named rectangular regions that group a part of the board. Moving a frame moves every
entry whose centre lies inside it, atomically on the server. Membership is by spatial containment,
not by a stored link.

## 7. Dashboard

Each board has an in-board dashboard (owners, editors and administrators) with:

- **Search** — Postgres full-text search plus tag-name matching, faceted by type, tag, creation
  date, region (a world-space rectangle) and link status (connected / unconnected); results show
  highlighted snippets and fly the camera to the hit.
- **Trash** with restore, **version history** per entry (the last 20 committed states) with exact
  restore.
- **Overview** — statistics and the **orphan view** (entries with neither a tag nor a thread).
- **Connection graph** (d3-force, loaded on demand).
- **Export** of the current viewport as PNG or PDF.

A separate **`/admin`** page for instance administrators manages accounts (create, rename, reset
password, promote/demote, delete — the last administrator cannot be demoted and nobody can delete
themselves), lists all boards, edits the global appearance defaults, shows statistics and is where
in-app **feedback** (bug reports and wishes, optionally with a screenshot of the board) is
reviewed.

## 8. Accounts, roles and sharing

- Email + password login only. **Open sign-up is disabled**; administrators create accounts in
  `/admin`. The first administrator is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on start
  ([ADR 0004](adr/0004-auth-and-board-access.md)).
- Instance roles: **`admin`** (full control of the instance, can see any board for moderation but
  edits only boards they own or are an editor of) and **`user`**.
- Every account owns exactly one **board**. Board rights come from ownership and membership, not
  from the instance role:

| Access level | How you get it | Sees | Can edit |
|---|---|---|---|
| owner | `boards.owner_id` | everything | yes |
| editor | invited member, role `editor` | everything | yes |
| viewer | invited member, role `viewer` | `public` entries only | no |
| share link | `/share/:token`, no account needed | `public` entries only | no |

- For viewers and share links a per-invite "show furniture" switch decides whether board-layer
  drawings, frames and teleports are visible too.
- All of this is enforced **on the server** in one place (`apps/api/src/services/board-access.ts`).
  Content routes live under `/api/boards/:boardId/*`; the account-less tree `/api/public/:token/*`
  has GET handlers only, so it cannot mutate anything by construction. A connection is returned
  only if both of its endpoints are visible to the caller.
- Concurrent editors work last-write-wins per entry; there is **no real-time collaboration** — other
  editors' changes appear on reload.

*Spec vs. code:* the original specification described a single board with one administrator and
read-only viewer accounts. The code has since become multi-board (one board per account, members
and share links) and allows several administrators.

## 9. Appearance

- **Per board** (owner, in `/account`): background (four textures — cork photo, classic cork, paper,
  linen — and four solid colours — sky, mint, sun, coral), default sticky colour, and font family and
  font size per entry type. These are sparse overrides on top of the instance-wide defaults that
  administrators set in `/admin`.
- **Per viewer** (browser): theme (light, dark, or a retro Windows-98 look) and UI language. The UI
  ships with an English and a German catalog; English is the default.
- Animations are lively but honour `prefers-reduced-motion`.

## 10. Persistence, offline and sync assumptions

- **The server is the source of truth.** The browser keeps only the loaded board in memory; there
  is no offline mode and no local copy of board data. The browser's `localStorage` holds only UI
  preferences (theme, language) — never board state or the camera
  ([ADR 0007](adr/0007-client-state-and-local-storage.md)).
- **Saving** is automatic and optimistic: a move or resize is saved on drop, text content when the
  edit is committed (editor blur, Escape, clicking elsewhere). There is no save button. On failure
  the change is rolled back and a toast is shown. Concurrent saves are last-write-wins.

*Spec vs. code:* the specification called for debounced saving while typing plus an unload flush.
The API has a `POST /api/boards/:boardId/entries/:id/beacon` endpoint for that, but the web app
does not call it yet — closing the tab while a document is open in the editor can lose the
uncommitted text.
- **Versions** are captured when an edit is committed (e.g. on editor blur), inside the same
  transaction, and pruned to the newest 20 per entry.
- **Undo/redo** is a client-side command stack covering every mutation (create, move, resize,
  content, tags, threads, strokes, frames, teleports). It is cleared when the user switches board or
  account so commands never replay against another board.
- Uploaded images are stored on a local volume and processed by the worker
  ([ADR 0005](adr/0005-assets-on-disk-and-worker.md)); remote images and link previews are fetched
  only through the SSRF guard ([ADR 0006](adr/0006-ssrf-guarded-fetching.md)).

## 11. Non-goals

- Real-time multi-user editing, presence cursors or CRDT-based sync.
- Self-registration, social login or anonymous editing.
- Arbitrary iframe embeds (only YouTube and Vimeo players are allowed).
- An offline-first client.
- Multiple boards per account (each account has one board; sharing covers collaboration).
- Hosted SaaS concerns such as billing or tenant isolation beyond the board-access model.

## 12. Data model (overview)

Defined with Drizzle in `packages/db/src/schema/`:

- **Auth** (Better Auth): `user` (with instance `role` and the persisted `camera`), `session`,
  `account`, `verification`.
- **Boards**: `boards` (one per owner, sparse `settings`), `board_members` (`editor` | `viewer`,
  `show_furniture`), `board_shares` (capability token, `show_furniture`, revoke/expiry),
  `app_settings` (singleton with the global appearance defaults).
- **Content** (all carry `board_id`): `entries` (type, geometry, `z_index`, `visibility`, `color`,
  `content` jsonb, `image_asset_id`, `search_text` plus a generated `tsvector` with a GIN index,
  `deleted_at`), `entry_versions`, `assets` (original path, variants, `processing_status`),
  `strokes` (points, tool, bbox), `connections`, `tags` + `entry_tags`, `frames`, `teleports`.
- **Feedback**: `feedback` (`kind` bug | wish, `status` open | done, optional screenshot).
