# ADR 0001 — Custom canvas engine instead of a whiteboard library

## Status

Accepted.

## Context

The core of Corkspace is an infinite board that must stay smooth with thousands of entries, many of
them rich documents, while the dashboard needs relational queries over the same data. Off-the-shelf
whiteboard SDKs either require a paid licence for production use (tldraw), store the board as an
opaque document (Excalidraw-style JSON, CRDT documents), or render to a single `<canvas>`, which
makes rich, editable HTML documents on the board hard.

The architecture that the better whiteboard tools document publicly is well understood: DOM
rendering, a spatial index for culling, signals instead of framework re-renders for the camera, and
level-of-detail swaps by on-screen size.

## Decision

Build the canvas ourselves, following that pattern:

- **Pure engine package.** `packages/engine` contains all canvas math — camera, world↔screen
  conversion, zoom-to-cursor, create-size, culling queries, LOD buckets, collision, connection
  routing, stroke outlines, shape paths, grid, minimap projection, flight tween and the undo/redo
  `CommandStack`. It is framework-agnostic and imports **only** `@corkspace/shared/kernel`
  (constants and branded coordinate types); `modularity.guard.test.ts` fails the build if it imports
  `api`, `db`, `web` or the root of `@corkspace/shared`. Coverage gate: 90 %.
- **Signals for the camera.** The camera is a `signia` atom. One reactor writes the world
  container's `transform` once per animation frame; the React entry tree does not re-render on pan
  or zoom. Selection outlines, collision outlines, minimap marker and anchor badges are painted
  imperatively for the same reason.
- **DOM entries, SVG overlays.** Entries are absolutely positioned DOM elements in world
  coordinates (so documents are real, editable HTML); threads and strokes are SVG layers inside the
  same world container.
- **Culling and LOD.** An rbush index answers "what is visible" each frame; entries off screen are
  hidden or unmounted, entries that are small on screen render as a lightweight block.
- **One live editor.** TipTap is mounted only for the entry being edited and unmounted on blur.

## Consequences

- Performance invariants are testable and tested: the perf suite asserts zero entry re-renders on
  pan, zoom and the idle re-snap frame, and that only the viewport plus the overscan ring is
  mounted on a board of 5 000 entries.
- Contributors must keep camera-dependent work out of React state. Anything that has to follow the
  camera is updated imperatively (see `apps/web/src/canvas/runtime/canvas-runtime.ts`).
- Browser paint quirks become our problem. Two examples that shipped invisible ink before being
  caught: Chromium does not paint a zero-size `<svg>` root, and it does not paint
  `vector-effect="non-scaling-stroke"` paths in these overlays. The overlays are therefore 1×1 px
  with `overflow: visible`, `vector-effect` is banned there (enforced by a component test), and
  screen-constant widths use a `--px` (= 1/zoom) CSS variable. Visibility claims in e2e tests need a
  pixel diff, not just DOM counts or bounding boxes.
- There is no licence dependency on a commercial SDK, and the data model stays relational
  ([ADR 0003](0003-postgres-drizzle-and-migrations.md)).
