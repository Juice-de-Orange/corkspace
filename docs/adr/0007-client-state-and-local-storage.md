# ADR 0007 — Board state lives on the server; localStorage only for UI preferences

## Status

Accepted.

## Context

It is tempting to cache the board, the camera or pending edits in `localStorage` or IndexedDB. That
creates a second source of truth per browser, stale data after edits on another device, leaks of a
board's content on shared computers, and hard-to-reproduce bugs. At the same time, purely visual
preferences of one viewer (theme, language) have no business on the server.

## Decision

- **No board state in browser storage.** Entries, strokes, threads, frames, teleports, tags,
  selection and the undo stack live in memory (signia atoms) only, loaded from the API.
- **The camera is server-persisted per user**: `user.camera` via `GET/PUT /api/me/camera`, written
  debounced. Reopening the board on any device restores the last view.
- **Board appearance is server-side too**: per-board overrides in `boards.settings`, global defaults
  in `app_settings`, merged by the pure `resolveEffectiveSettings`.
- **`localStorage` is allowed only for per-viewer UI preferences**: the theme
  (`corkspace-theme`) and the UI language (`corkspace-lang`). Reads and writes are wrapped so that
  private browsing or disabled storage falls back to defaults.
- **Undo/redo** is a client-side command stack: every mutation is a command with `do`/`undo`, run
  through `history.execute`. Redo of a create restores the same soft-deleted row instead of creating
  a new one.
- **Board switch resets client state.** Switching board or account is a client-side navigation, so
  module-level singletons survive it. `resetBoardClientState()` clears the history, selection,
  clipboard, connect/draw state and loaded board data on every switch and on sign-out, so undo can
  never replay commands against another board.

## Consequences

- There is no offline mode; a lost connection means failed saves, which roll back with a toast.
- Opening the same board in two tabs is safe but last-write-wins.
- New UI preferences may use `localStorage` (with the same defensive wrapper and a
  `corkspace-` key prefix); anything describing board content may not.
- New per-board client singletons must be added to `resetBoardClientState()` together with a test.
