import { atom } from 'signia'

export interface StrokeMeta {
  id: string
  entryId: string | null
  points: number[][]
  color: string
  size: number
  tool: string
}

export const strokesAtom = atom<ReadonlyMap<string, StrokeMeta>>('strokes', new Map())

export type DrawTool = 'pen' | 'marker' | 'line' | 'arrow' | 'rect' | 'eraser'

/** Active drawing tool (null = not drawing). */
export const drawToolAtom = atom<DrawTool | null>('drawTool', null)
export const penColorAtom = atom<string>('penColor', '#1a1a1a')
export const penWidthAtom = atom<number>('penWidth', 4)

/** Curated pen/marker palette + widths for the draw sub-toolbar. */
export const DRAW_COLORS = [
  '#1a1a1a',
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#7c3aed',
] as const
export const PEN_WIDTHS = [2, 4, 8] as const

/** In-progress stroke being drawn (world points), rendered as a live preview. */
export const liveStrokeAtom = atom<{
  points: number[][]
  color: string
  size: number
  tool: DrawTool
} | null>('liveStroke', null)

/** Reference on-screen stroke width (divided by zoom at draw start): marker is a fat
 *  translucent highlighter; pen and the shape tools use the picked width directly. */
export const sizeForTool = (tool: DrawTool, width: number): number =>
  tool === 'marker' ? Math.max(14, width * 5) : width

export function loadStrokes(rows: StrokeMeta[]): void {
  strokesAtom.set(new Map(rows.map((r) => [r.id, r])))
}

export function upsertStroke(s: StrokeMeta): void {
  const next = new Map(strokesAtom.value)
  next.set(s.id, s)
  strokesAtom.set(next)
}

export function removeStroke(id: string): void {
  const next = new Map(strokesAtom.value)
  if (next.delete(id)) {
    strokesAtom.set(next)
  }
}
