import type { Command } from '@corkspace/engine'
import { apiCreateConnection, apiDeleteConnection, apiPatchConnection } from '../api/connections'
import { type ConnMeta, removeConnection, upsertConnection } from '../canvas/state/connection-store'
import { t } from '../i18n'
import { saving } from './saving'

type ConnPatch = { color?: string; label?: string | null; arrowStart?: boolean; arrowEnd?: boolean }

/** Create a red-thread connection between two entries; undo deletes it. */
export function createConnectionCommand(fromEntryId: string, toEntryId: string): Command {
  let created: ConnMeta | null = null
  return {
    type: 'create-connection',
    labelKey: 'command.connect',
    do: async () => {
      await saving(
        async () => {
          created = await apiCreateConnection({ fromEntryId, toEntryId })
          upsertConnection(created)
        },
        undefined,
        t('cmd.connectFailed'),
      )
    },
    undo: async () => {
      if (created) {
        // Best-effort undo cleanup: the local store is updated regardless; a reload reconciles the
        // server if this delete fails. (The forward path uses saving() + a toast.)
        await apiDeleteConnection(created.id).catch(() => {})
        removeConnection(created.id)
      }
    },
  }
}

/** Edit a connection's label / arrowheads / colour (optimistic + rollback + toast). */
export function patchConnectionCommand(conn: ConnMeta, patch: ConnPatch): Command {
  const before: ConnMeta = { ...conn }
  const after: ConnMeta = { ...conn, ...patch }
  const revert: ConnPatch = {
    color: before.color,
    label: before.label,
    arrowStart: before.arrowStart,
    arrowEnd: before.arrowEnd,
  }
  return {
    type: 'patch-connection',
    labelKey: 'command.editConnection',
    do: async () => {
      upsertConnection(after)
      await saving(
        () => apiPatchConnection(conn.id, patch),
        () => upsertConnection(before),
        t('cmd.patchFailed'),
      )
    },
    undo: async () => {
      upsertConnection(before)
      await saving(
        () => apiPatchConnection(conn.id, revert),
        () => upsertConnection(after),
        t('cmd.patchFailed'),
      )
    },
  }
}

/** Delete a connection; undo re-creates an equivalent one. */
export function deleteConnectionCommand(conn: ConnMeta): Command {
  let recreated: ConnMeta | null = null
  return {
    type: 'delete-connection',
    labelKey: 'command.deleteConnection',
    do: async () => {
      await apiDeleteConnection(conn.id)
      removeConnection(conn.id)
    },
    undo: async () => {
      await saving(
        async () => {
          recreated = await apiCreateConnection({
            fromEntryId: conn.fromEntryId,
            toEntryId: conn.toEntryId,
          })
          upsertConnection(recreated)
        },
        undefined,
        t('cmd.connectFailed'),
      )
    },
  }
}
