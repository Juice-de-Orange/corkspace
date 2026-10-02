# ADR 0002 — World coordinates, branded types and a client-side spatial index

## Status

Accepted.

## Context

Every entry has a real position on an infinite board. The code constantly converts between the
board's coordinate system and the browser's pixels — pointer input, culling, LOD, drawing, minimap,
export. Mixing the two silently is the most common source of canvas bugs (wrong anchor after zoom,
strokes that drift, hit tests that miss).

The board can hold thousands of entries; deciding which of them intersect the viewport, a dragged
entry or an eraser path needs to be fast and must not hit the server.

## Decision

- **World coordinates are the only persisted coordinates.** Entries, frames, strokes, teleports and
  the per-user camera are stored in world units. Screen coordinates exist only in the browser.
- **Branded types.** `World*` and `Screen*` points, sizes and rects are distinct TypeScript types
  (phantom `unique symbol` brands) defined once in `packages/shared/src/kernel/coords.ts`. Conversion
  happens only through pure, unit-tested engine functions (`screenToWorld`, `worldToScreen`,
  zoom-to-cursor), so the compiler rejects accidental mixing.
- **Entry-local coordinates** for strokes anchored to an entry: points are relative to the entry's
  unrotated top-left, so the stroke follows moves, rotation and top-left-fixed resizes for free.
- **Size rule.** A new entry's world size is `reference on-screen size ÷ current zoom`, so it looks
  normal when created and then scales like everything else. Stroke widths follow the same rule.
- **rbush in the browser.** All entry bounding boxes live in an rbush R-tree
  (`packages/engine/src/spatial`). It serves viewport culling (with an overscan ring) and the
  broad phase of collision detection (1 px AABB). The server returns all entry metadata and
  positions on load; spatial queries never go to the database.
- **Server-side bounding boxes for strokes.** The server computes a stroke's bbox from its points
  and never trusts one sent by the client.

## Consequences

- New canvas code must declare which space it works in and convert through the engine; reviewers
  should reject ad-hoc `x * zoom + offset` arithmetic in components.
- The initial board payload grows with the number of entries (metadata only, no bodies). This is
  fine at thousands of entries; a server-side spatial query would be needed for far larger boards.
- Region search on the dashboard is a simple bbox filter on entry origins in SQL, independent of
  the client index.
- Product constants (zoom bounds 0.02–8, LOD thresholds, overscan, reference sizes, version
  retention) live in one dependency-free module, `packages/shared/src/kernel/constants.ts`, shared by
  engine, web and api.
