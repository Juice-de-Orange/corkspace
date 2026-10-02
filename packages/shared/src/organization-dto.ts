import { z } from 'zod'

/** Rule-based styling a tag applies to its entries. */
export const tagStyleSchema = z
  .object({
    borderColor: z.string().max(32).optional(),
    background: z.string().max(32).optional(),
    emphasize: z.boolean().optional(),
  })
  .strict()
export type TagStyle = z.infer<typeof tagStyleSchema>

export const createTagSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    color: z.string().min(1).max(32),
    styleRules: tagStyleSchema.default({}),
  })
  .strict()
export type CreateTagInput = z.infer<typeof createTagSchema>

export const patchTagSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: z.string().min(1).max(32).optional(),
    styleRules: tagStyleSchema.optional(),
  })
  .strict()

export const setEntryTagsSchema = z.object({ tagIds: z.array(z.string().uuid()).max(50) }).strict()

export const createFrameSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    color: z.string().max(32).nullable().optional(),
  })
  .strict()
export type CreateFrameInput = z.infer<typeof createFrameSchema>

export const patchFrameSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().positive().optional(),
    height: z.number().finite().positive().optional(),
    color: z.string().max(32).nullable().optional(),
  })
  .strict()

export const createTeleportSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: z.number().finite().positive(),
    isBoardButton: z.boolean().default(false),
    boardX: z.number().finite().nullable().optional(),
    boardY: z.number().finite().nullable().optional(),
    icon: z.string().max(32).nullable().optional(),
    color: z.string().max(32).nullable().optional(),
  })
  .strict()
export type CreateTeleportInput = z.infer<typeof createTeleportSchema>

export const createViewerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(200),
    name: z.string().trim().min(1).max(120),
  })
  .strict()
export type CreateViewerInput = z.infer<typeof createViewerSchema>

/** Instance-level role. 'admin' = super-admin (full control: the /admin surface, moderation, sees
 *  all boards). Everything else is a normal 'user'; board edit rights come from ownership/membership,
 *  not this field. */
export const userRoleSchema = z.enum(['admin', 'user'])
export type UserRole = z.infer<typeof userRoleSchema>

/** Super-admin create-user, optionally directly as an admin (role defaults to 'user' server-side). */
export const adminCreateUserSchema = createViewerSchema.extend({
  role: userRoleSchema.optional(),
})
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>

/** Super-admin patch of a user — any subset of role / name / password (at least one required). */
export const adminPatchUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.name !== undefined || v.password !== undefined, {
    message: 'at least one of role, name or password is required',
  })
export type AdminPatchUserInput = z.infer<typeof adminPatchUserSchema>

/** Merge the style rules of an entry's tags into one resolved style (later tags win per-field). */
export function resolveEntryStyle(rulesList: ReadonlyArray<TagStyle | null | undefined>): TagStyle {
  const out: TagStyle = {}
  for (const r of rulesList) {
    if (!r) {
      continue
    }
    if (r.borderColor !== undefined) {
      out.borderColor = r.borderColor
    }
    if (r.background !== undefined) {
      out.background = r.background
    }
    if (r.emphasize !== undefined) {
      out.emphasize = r.emphasize
    }
  }
  return out
}
