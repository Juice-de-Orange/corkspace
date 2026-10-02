import { z } from 'zod'

/** Validated persisted camera ({x,y,zoom}) for restore-last-position. */
export const cameraSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().positive(),
})

export type CameraDto = z.infer<typeof cameraSchema>
