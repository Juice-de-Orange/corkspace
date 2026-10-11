# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- First public release: infinite canvas with culling and level of detail, five entry types,
  red threads, freehand drawing, frames, teleports, tags, per-user boards with editor/viewer
  invitations and share links, admin area, dashboard with search, graph, trash and version
  history, PNG/PDF export, light/dark/retro themes, touch UI.
- `pnpm db:seed-demo` fills a board with synthetic demo content.

### Fixed

- Creating an entry with an `imageAssetId` that does not exist or was uploaded to another board is
  rejected with 400 (it failed with a database error, or attached another board's image) (#5).
- Quick successive edits of the same entry (for example adding a checklist item and ticking it
  right away) could be saved out of order, so a reload showed the older state. Saves of one entry
  are now sent one after another, newest last (#6).
- Text typed into an open document, sticky note or checklist item was lost when the tab was closed,
  reloaded or hidden before the editor lost focus. It is now saved at that moment (with `keepalive`,
  so the request completes after the page is gone); the editor stays open (#9).
- Quick successive edits of the same entry (for example adding a checklist item and ticking it
  right away) could be saved out of order, so a reload showed the older state. Saves of one entry
  are now sent one after another, newest last (#6).
- Text typed into an open document, sticky note or checklist item was lost when the tab was closed,
  reloaded or hidden before the editor lost focus. It is now saved at that moment (with `keepalive`,
  so the request completes after the page is gone); the editor stays open (#9).
- Jump-to flights (search results, internal links, teleports) stopped after their first frame when
  the board was idle: the camera reaction set another atom inside signia's reaction cycle, which
  throws. The flag is now set in a microtask; a regression test covers the idle case.

### Changed

- English is the default UI language; German is picked from a German browser language or the
  toggle.
- Appearance background ids are English (`cork-photo`, `paper`, …); migration `0008` rewrites
  stored values.
- `POSTGRES_PASSWORD` is required by the compose file (no fallback password); the optional
  Cloudflare tunnel service was removed in favour of a generic reverse-proxy setup.
