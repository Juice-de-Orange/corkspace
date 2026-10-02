import type { Command } from '@corkspace/engine'
import { fetchEntryMetas } from '../api/entries'
import { apiCreateFrame, apiDeleteFrame, apiMoveFrame, fetchFrames } from '../api/frames'
import { loadEntries } from '../canvas/state/entry-store'
import { type FrameMeta, loadFrames, removeFrame, upsertFrame } from '../canvas/state/frame-store'
import { pushError } from '../canvas/state/toast-store'
import { t } from '../i18n'

export function createFrameCommand(input: {
  name: string
  x: number
  y: number
  width: number
  height: number
}): Command {
  let created: FrameMeta | null = null
  return {
    type: 'create-frame',
    labelKey: 'command.createFrame',
    do: async () => {
      created = await apiCreateFrame(input)
      upsertFrame(created)
    },
    undo: async () => {
      if (created) {
        await apiDeleteFrame(created.id)
        removeFrame(created.id)
      }
    },
  }
}

/** Frame group-move is server-side atomic (frame + contained entries); reload reflects it. */
export function moveFrameCommand(frame: FrameMeta, dx: number, dy: number): Command {
  const shift = async (ddx: number, ddy: number): Promise<void> => {
    await apiMoveFrame(frame.id, ddx, ddy)
    const [metas, frames] = await Promise.all([fetchEntryMetas(), fetchFrames()])
    loadEntries(metas)
    loadFrames(frames)
  }
  return {
    type: 'move-frame',
    labelKey: 'command.moveFrame',
    do: () => shift(dx, dy),
    undo: () => shift(-dx, -dy),
  }
}

/** Delete a frame; undo re-creates it (fresh id, tracked so redo deletes the right one). */
export function deleteFrameCommand(frame: FrameMeta): Command {
  let currentId = frame.id
  return {
    type: 'delete-frame',
    labelKey: 'command.deleteFrame',
    do: async () => {
      await apiDeleteFrame(currentId).catch(() => pushError(t('cmd.frameDeleteFailed')))
      removeFrame(currentId)
    },
    undo: async () => {
      const created = await apiCreateFrame({
        name: frame.name,
        x: frame.x,
        y: frame.y,
        width: frame.w,
        height: frame.h,
      })
      currentId = created.id
      upsertFrame(created)
    },
  }
}
