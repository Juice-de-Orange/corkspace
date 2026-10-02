import { z } from 'zod'

export const feedbackKindSchema = z.enum(['bug', 'wish'])
export type FeedbackKind = z.infer<typeof feedbackKindSchema>

export const feedbackStatusSchema = z.enum(['open', 'done'])
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>

/** A bug report or improvement wish, with an optional screenshot (image data URL). */
export const createFeedbackSchema = z
  .object({
    kind: feedbackKindSchema,
    message: z.string().trim().min(1).max(5000),
    context: z.string().max(2000).optional(),
    // data URL of a JPEG/PNG/WebP screenshot of the current view (cap ~6 MB base64).
    screenshot: z
      .string()
      .max(6_000_000)
      .regex(/^data:image\/(jpeg|png|webp);base64,/, 'must be an image data URL')
      .optional(),
  })
  .strict()
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>

export const patchFeedbackSchema = z.object({ status: feedbackStatusSchema }).strict()
