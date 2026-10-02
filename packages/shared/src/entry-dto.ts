import { z } from 'zod'
import type { EntryType } from './kernel/constants'

// --- Per-type content schemas (the entry `type` column is the discriminant) ---

export const stickyContent = z.object({ text: z.string().max(4000).default('') })
export const docContent = z.object({ doc: z.record(z.string(), z.unknown()) })
export const checklistContent = z.object({
  items: z
    .array(z.object({ id: z.string(), text: z.string().max(2000), checked: z.boolean() }))
    .max(500),
})
export const imageContent = z.object({ alt: z.string().max(1000).optional() })
export const linkContent = z.object({
  url: z.string().url(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  image: z.string().optional(),
  siteName: z.string().max(200).optional(),
})

export const contentSchemas = {
  sticky: stickyContent,
  doc: docContent,
  checklist: checklistContent,
  image: imageContent,
  link: linkContent,
} satisfies Record<EntryType, z.ZodTypeAny>

export type EntryContent =
  | z.infer<typeof stickyContent>
  | z.infer<typeof docContent>
  | z.infer<typeof checklistContent>
  | z.infer<typeof imageContent>
  | z.infer<typeof linkContent>

export function validateContent(type: EntryType, content: unknown): boolean {
  return contentSchemas[type].safeParse(content).success
}

// --- Create / patch DTOs ---

const entryTypeSchema = z.enum(['sticky', 'doc', 'checklist', 'image', 'link'])
const visibilitySchema = z.enum(['public', 'private'])

export const createEntrySchema = z
  .object({
    type: entryTypeSchema,
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite().default(0),
    zIndex: z.number().int().default(0),
    visibility: visibilitySchema.default('private'),
    color: z.string().max(32).nullable().optional(),
    content: z.unknown(),
    imageAssetId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!validateContent(val.type, val.content)) {
      ctx.addIssue({
        code: 'custom',
        message: `invalid content for ${val.type}`,
        path: ['content'],
      })
    }
  })

export type CreateEntryInput = z.infer<typeof createEntrySchema>

/** Autosave patch. `rev` is a monotonic client revision (last-write-wins, drop-stale).
 *  `commitVersion` requests an entry_versions snapshot of the prior state (editor blur). */
export const patchEntrySchema = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().positive().optional(),
    height: z.number().finite().positive().optional(),
    rotation: z.number().finite().optional(),
    zIndex: z.number().int().optional(),
    visibility: visibilitySchema.optional(),
    color: z.string().max(32).nullable().optional(),
    content: z.unknown().optional(),
    rev: z.number().int().optional(),
    commitVersion: z.boolean().optional(),
  })
  .strict()

export type PatchEntryInput = z.infer<typeof patchEntrySchema>

// --- Plain-text extraction (feeds entries.search_text → generated tsvector) ---

/** Collect the text of a TipTap/ProseMirror JSON document. */
export function tiptapToPlainText(doc: unknown): string {
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') {
      return
    }
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') {
      out.push(n.text)
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child)
      }
    }
  }
  walk(doc)
  return out.join(' ').trim()
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Derive the searchable plain text for an entry from its type + content. */
export function entrySearchText(type: EntryType, content: unknown): string {
  const c = (content ?? {}) as Record<string, unknown>
  switch (type) {
    case 'sticky':
      return str(c.text)
    case 'checklist':
      return Array.isArray(c.items)
        ? c.items.map((i) => str((i as Record<string, unknown>).text)).join(' ')
        : ''
    case 'link':
      return [str(c.title), str(c.description), str(c.url), str(c.siteName)]
        .filter(Boolean)
        .join(' ')
    case 'image':
      return str(c.alt)
    case 'doc':
      return tiptapToPlainText(c.doc)
  }
}
