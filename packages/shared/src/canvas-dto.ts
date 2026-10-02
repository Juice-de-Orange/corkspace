import { z } from 'zod'

export const strokeToolSchema = z.enum(['pen', 'marker', 'line', 'arrow', 'rect'])
export type StrokeTool = z.infer<typeof strokeToolSchema>

/** A stroke point: [x, y] or [x, y, pressure]. */
const strokePointSchema = z.array(z.number().finite()).min(2).max(3)

export const createStrokeSchema = z
  .object({
    entryId: z.string().uuid().nullable().optional(),
    points: z.array(strokePointSchema).min(1).max(10_000),
    color: z.string().min(1).max(32),
    size: z.number().finite().positive().max(400),
    tool: strokeToolSchema.default('pen'),
  })
  .strict()
export type CreateStrokeInput = z.infer<typeof createStrokeSchema>

export const createConnectionSchema = z
  .object({
    fromEntryId: z.string().uuid(),
    toEntryId: z.string().uuid(),
    color: z.string().min(1).max(32).default('#dc2626'),
    label: z.string().max(200).nullable().optional(),
    arrowStart: z.boolean().default(false),
    arrowEnd: z.boolean().default(true),
  })
  .strict()
  .refine((d) => d.fromEntryId !== d.toEntryId, {
    message: 'a connection must link two different entries',
  })
export type CreateConnectionInput = z.infer<typeof createConnectionSchema>

export const patchConnectionSchema = z
  .object({
    color: z.string().min(1).max(32).optional(),
    label: z.string().max(200).nullable().optional(),
    arrowStart: z.boolean().optional(),
    arrowEnd: z.boolean().optional(),
  })
  .strict()
export type PatchConnectionInput = z.infer<typeof patchConnectionSchema>

/** Tight bbox of raw stroke points (server-computed; never trusted from the client). */
export function strokePointsBbox(points: ReadonlyArray<ReadonlyArray<number>>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of points) {
    const x = p[0] ?? 0
    const y = p[1] ?? 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}
