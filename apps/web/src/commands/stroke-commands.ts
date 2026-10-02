import type { Command } from '@corkspace/engine'
import { apiCreateStroke, apiDeleteStroke } from '../api/strokes'
import { removeStroke, type StrokeMeta, upsertStroke } from '../canvas/state/stroke-store'
import { t } from '../i18n'
import { saving } from './saving'

let tempSeq = 0

interface StrokeInput {
  entryId?: string | null
  points: number[][]
  color: string
  size: number
  tool: string
}

/** Commit a freehand stroke OPTIMISTICALLY (shows immediately, reconciles the server id), so a
 *  failed save no longer silently drops the stroke — it rolls back and surfaces a toast. */
export function createStrokeCommand(input: StrokeInput): Command {
  let created: StrokeMeta | null = null
  return {
    type: 'create-stroke',
    labelKey: 'command.draw',
    do: async () => {
      const tempId = `temp-stroke-${++tempSeq}`
      upsertStroke({
        id: tempId,
        entryId: input.entryId ?? null,
        points: input.points,
        color: input.color,
        size: input.size,
        tool: input.tool,
      })
      await saving(
        async () => {
          const real = await apiCreateStroke(input)
          removeStroke(tempId)
          created = real
          upsertStroke(real)
        },
        () => removeStroke(tempId),
        t('cmd.strokeSaveFailed'),
      )
    },
    undo: async () => {
      if (created) {
        removeStroke(created.id)
        // Best-effort undo cleanup: store already reverted; a reload reconciles if this delete fails.
        await apiDeleteStroke(created.id).catch(() => {})
        created = null
      }
    },
  }
}

/** Delete a board stroke (eraser). Optimistic; undo re-creates it. */
export function deleteStrokeCommand(stroke: StrokeMeta): Command {
  let recreated: StrokeMeta | null = null
  return {
    type: 'delete-stroke',
    labelKey: 'command.erase',
    do: async () => {
      removeStroke(recreated?.id ?? stroke.id)
      // Eraser is optimistic + rapid-fire (a drag erases many); the stroke is preserved server-side
      // on failure (no data loss) and reconciles on reload — so this stays best-effort, not a toast.
      await apiDeleteStroke(recreated?.id ?? stroke.id).catch(() => {})
    },
    undo: async () => {
      await saving(
        async () => {
          recreated = await apiCreateStroke({
            entryId: stroke.entryId,
            points: stroke.points,
            color: stroke.color,
            size: stroke.size,
            tool: stroke.tool,
          })
          upsertStroke(recreated)
        },
        undefined,
        t('cmd.restoreFailed'),
      )
    },
  }
}
