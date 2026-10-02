import { z } from 'zod'

// --- Dashboard search facets (full-text + type + tags + date + region + link-status) ---

const entryTypeSchema = z.enum(['sticky', 'doc', 'checklist', 'image', 'link'])

/** A world-space bounding box used for the position/region facet. */
export const searchRegionSchema = z
  .object({
    minX: z.number().finite(),
    minY: z.number().finite(),
    maxX: z.number().finite(),
    maxY: z.number().finite(),
  })
  .strict()
export type SearchRegion = z.infer<typeof searchRegionSchema>

/**
 * `linked` = the entry participates in at least one connection; `unlinked` = it has none.
 * (Decision 2026-06-29: "link status" is interpreted as connection participation — it
 * complements the orphan view and the connection graph; see docs/adr/.)
 */
export const linkStatusSchema = z.enum(['linked', 'unlinked'])
export type LinkStatus = z.infer<typeof linkStatusSchema>

export const searchParamsSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    types: z.array(entryTypeSchema).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    includeDeleted: z.boolean().optional(),
    createdAfter: z.string().datetime().optional(),
    createdBefore: z.string().datetime().optional(),
    region: searchRegionSchema.optional(),
    linkStatus: linkStatusSchema.optional(),
  })
  .strict()
export type SearchParams = z.infer<typeof searchParamsSchema>

/** Reorder a region's corners so min ≤ max on each axis (callers may pass corners either way). */
export function normalizeRegion(r: SearchRegion): SearchRegion {
  return {
    minX: Math.min(r.minX, r.maxX),
    maxX: Math.max(r.minX, r.maxX),
    minY: Math.min(r.minY, r.maxY),
    maxY: Math.max(r.minY, r.maxY),
  }
}

/**
 * Canonicalize parsed search params before building the DB query: drop empty/blank facets
 * (so they never become a degenerate `IN ()` or all-pass filter), de-duplicate id lists, and
 * normalize the region. Pure — unit-tested; the SQL assembled from it is integration-tested.
 */
export function normalizeSearchParams(p: SearchParams): SearchParams {
  const out: SearchParams = {}
  const q = p.q?.trim()
  if (q) {
    out.q = q
  }
  if (p.types && p.types.length > 0) {
    out.types = [...new Set(p.types)]
  }
  if (p.tagIds && p.tagIds.length > 0) {
    out.tagIds = [...new Set(p.tagIds)]
  }
  if (p.includeDeleted) {
    out.includeDeleted = true
  }
  if (p.createdAfter) {
    out.createdAfter = p.createdAfter
  }
  if (p.createdBefore) {
    out.createdBefore = p.createdBefore
  }
  if (p.region) {
    out.region = normalizeRegion(p.region)
  }
  if (p.linkStatus) {
    out.linkStatus = p.linkStatus
  }
  return out
}
