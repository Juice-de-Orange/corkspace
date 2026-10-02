/**
 * Product constants — the single source of truth for sizes, zoom bounds, palette,
 * LOD thresholds and other tunables. This module is dependency-free so that
 * `@corkspace/engine` (pure, framework-agnostic) can import it without pulling in any
 * runtime dependency. See docs/adr/.
 */

export type EntryType = 'sticky' | 'doc' | 'checklist' | 'image' | 'link'

export const ENTRY_TYPES: readonly EntryType[] = ['sticky', 'doc', 'checklist', 'image', 'link']

/** Majorelle blue accent. */
export const ACCENT = '#6050DC'

/** Camera zoom default and bounds ("galaxy feel"). */
export const ZOOM = { default: 1, min: 0.02, max: 8 } as const

/** Reference on-screen sizes at zoom 1.0 (world units). A new entry is created at
 *  `reference / zoom` so it looks normal on screen at the current zoom. */
export const REFERENCE_SIZES = {
  sticky: { w: 240, h: 240 },
  doc: { w: 400, h: 520 },
  checklist: { w: 320, h: 420 },
  link: { w: 320, h: 120 },
} as const satisfies Partial<Record<EntryType, { w: number; h: number }>>

/** Long edge of an uploaded image is capped to this many px on create. */
export const IMAGE_LONG_EDGE_CAP = 800

export const STICKY_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'] as const
export type StickyColor = (typeof STICKY_COLORS)[number]

/** Level-of-detail thresholds by the longer on-screen edge (px): `>= fullPx` renders
 *  full content, `>= previewPx` a static preview, otherwise a coloured block. */
export const LOD_THRESHOLDS = { fullPx: 200, previewPx: 36 } as const

/** Collision is flagged at 1px AABB intersection. */
export const COLLISION_PX = 1
/** Overscan ring (screen px) kept mounted but hidden around the viewport. Sized to pre-mount a
 *  comfortable margin so entries entering the viewport on pan/zoom paint without a blank frame. */
export const OVERSCAN_PX = 500
/** Snap radius (screen px) for Figma-style alignment guides / grid snapping. */
export const SNAP_RADIUS_PX = 8
/** Maximum absolute random tilt (degrees) applied to a new entry. */
export const MAX_TILT_DEG = 4
/** Number of versions retained per entry. */
export const VERSION_RETENTION = 20

/** Curated font families (self-hosted via @fontsource). */
export const FONTS = {
  serif: 'Source Serif 4',
  sans: 'Inter',
  mono: 'JetBrains Mono',
  hand: 'Caveat',
} as const
