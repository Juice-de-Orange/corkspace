import { z } from 'zod'
import { partialSettingsSchema } from './settings-dto'

/** Board membership + sharing DTOs (M2). */

export const BOARD_MEMBER_ROLES = ['editor', 'viewer'] as const
export type BoardMemberRole = (typeof BOARD_MEMBER_ROLES)[number]

/** Owner invites an already-registered user (by email) to their board. */
export const inviteMemberSchema = z
  .object({
    email: z.string().email(),
    role: z.enum(BOARD_MEMBER_ROLES),
    // Whether a viewer member also sees board-layer drawings/frames/teleports ("full board look").
    showFurniture: z.boolean().default(true),
  })
  .strict()
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

export const patchMemberSchema = z
  .object({
    role: z.enum(BOARD_MEMBER_ROLES).optional(),
    showFurniture: z.boolean().optional(),
  })
  .strict()
export type PatchMemberInput = z.infer<typeof patchMemberSchema>

/** Owner creates an external, account-less read link. */
export const createShareSchema = z
  .object({
    label: z.string().trim().max(120).nullable().optional(),
    showFurniture: z.boolean().default(true),
  })
  .strict()
export type CreateShareInput = z.infer<typeof createShareSchema>

/** Owner renames / re-styles their board. */
export const patchBoardSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    settings: partialSettingsSchema.optional(),
  })
  .strict()
export type PatchBoardInput = z.infer<typeof patchBoardSchema>
