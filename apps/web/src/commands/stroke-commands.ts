import type { Command } from '@corkspace/engine'
import { apiCreateStroke, apiDeleteStroke } from '../api/strokes'
import { removeStroke, type StrokeMeta, upsertStroke } from '../canvas/state/stroke-store'
import { t } from '../i18n'
import { saving } from './saving'

let tempSeq = 0

/**
 * A stroke can change its id: a temporary id while its create request runs, then the server id,
 * and a new server id each time an undo re-creates it. Every id it ever had points to the next one,
 * so a command that captured an older id acts on the stroke as it is now.
 */
const nextId = new Map<string, string>()

function currentId(id: string): string {
  let cur = id
  for (let next = nextId.get(cur); next !== undefined; next = nextId.get(cur)) {
    cur = next
  }
  return cur
}

/** Create requests still running, by temporary id; resolve once the request has settled. */
const pendingCreates = new Map<string, Promise<void>>()
/** Temporary ids erased (or undone) before their create request finished (#7). */
const cancelledCreates = new Set<string>()

interface StrokeInput {
  entryId?: string | null
  points: number[][]
  color: string
  size: number
  tool: string
}

/** Commit a freehand stroke OPTIMISTICALLY (shows immediately, reconciles the server id), so a
 *  failed save no longer silently drops the stroke — it rolls back and surfaces a toast. Erasing or
 *  undoing it before the save completes cancels it: it stays gone and is deleted on the server as
 *  soon as its id is known. */
export function createStrokeCommand(input: StrokeInput): Command {
  let lastId: string | null = null
  return {
    type: 'create-stroke',
    labelKey: 'command.draw',
    do: async () => {
      const tempId = `temp-stroke-${++tempSeq}`
      if (lastId) {
        // Redo: commands that captured the previous id now act on this new stroke.
        nextId.set(currentId(lastId), tempId)
      }
      lastId = tempId
      upsertStroke({
        id: tempId,
        entryId: input.entryId ?? null,
        points: input.points,
        color: input.color,
        size: input.size,
        tool: input.tool,
      })
      let settle = () => {}
      pendingCreates.set(
        tempId,
        new Promise<void>((resolve) => {
          settle = resolve
        }),
      )
      try {
        await saving(
          async () => {
            const real = await apiCreateStroke(input)
            nextId.set(tempId, real.id)
            lastId = real.id
            if (cancelledCreates.delete(tempId)) {
              await apiDeleteStroke(real.id).catch(() => {})
            } else {
              removeStroke(tempId)
              upsertStroke(real)
            }
          },
          () => {
            cancelledCreates.delete(tempId)
            removeStroke(tempId)
          },
          t('cmd.strokeSaveFailed'),
        )
      } finally {
        pendingCreates.delete(tempId)
        settle()
      }
    },
    undo: async () => {
      if (lastId) {
        await eraseStroke(lastId)
      }
    },
  }
}

/** Remove a stroke locally and on the server. A stroke whose create request is still running is
 *  cancelled instead; this waits until that request has settled. */
async function eraseStroke(id: string): Promise<void> {
  const cur = currentId(id)
  removeStroke(cur)
  const pending = pendingCreates.get(cur)
  if (pending) {
    cancelledCreates.add(cur)
    await pending
    return
  }
  // Best-effort: the store already reflects the removal; a reload reconciles if this fails.
  await apiDeleteStroke(cur).catch(() => {})
}

/** Delete a board stroke (eraser). Optimistic; undo re-creates it. */
export function deleteStrokeCommand(stroke: StrokeMeta): Command {
  return {
    type: 'delete-stroke',
    labelKey: 'command.erase',
    // Eraser is optimistic + rapid-fire (a drag erases many); the stroke is preserved server-side
    // on failure (no data loss) and reconciles on reload — so this stays best-effort, not a toast.
    // Erasing a stroke that is still being saved waits for that save, so this command lands on the
    // undo stack after the one that drew it.
    do: () => eraseStroke(stroke.id),
    undo: async () => {
      await saving(
        async () => {
          const recreated = await apiCreateStroke({
            entryId: stroke.entryId,
            points: stroke.points,
            color: stroke.color,
            size: stroke.size,
            tool: stroke.tool,
          })
          nextId.set(currentId(stroke.id), recreated.id)
          upsertStroke(recreated)
        },
        undefined,
        t('cmd.restoreFailed'),
      )
    },
  }
}
