import type { Command } from '@corkspace/engine'
import { apiCreateTeleport, apiDeleteTeleport } from '../api/teleports'
import { removeTeleport, type TeleportMeta, upsertTeleport } from '../canvas/state/teleport-store'
import { pushError } from '../canvas/state/toast-store'
import { t as translate } from '../i18n'

interface CreateTeleportInput {
  name: string
  x: number
  y: number
  zoom: number
  isBoardButton?: boolean
  boardX?: number | null
  boardY?: number | null
}

export function createTeleportCommand(input: CreateTeleportInput): Command {
  let created: TeleportMeta | null = null
  return {
    type: 'create-teleport',
    labelKey: 'command.createTeleport',
    do: async () => {
      created = await apiCreateTeleport(input)
      upsertTeleport(created)
    },
    undo: async () => {
      if (created) {
        await apiDeleteTeleport(created.id)
        removeTeleport(created.id)
      }
    },
  }
}

/** Delete a teleport; undo re-creates it (fresh id, tracked so redo deletes the right one). */
export function deleteTeleportCommand(t: TeleportMeta): Command {
  let currentId = t.id
  return {
    type: 'delete-teleport',
    labelKey: 'command.deleteTeleport',
    do: async () => {
      await apiDeleteTeleport(currentId).catch(() =>
        pushError(translate('cmd.teleportDeleteFailed')),
      )
      removeTeleport(currentId)
    },
    undo: async () => {
      const created = await apiCreateTeleport({
        name: t.name,
        x: t.x,
        y: t.y,
        zoom: t.zoom,
        isBoardButton: t.isBoardButton,
        boardX: t.boardX,
        boardY: t.boardY,
      })
      currentId = created.id
      upsertTeleport(created)
    },
  }
}
