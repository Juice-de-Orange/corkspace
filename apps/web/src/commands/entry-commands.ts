import type { Command } from '@corkspace/engine'
import type { CreateEntryInput } from '@corkspace/shared'
import { apiRestore } from '../api/dashboard'
import { apiCreateEntry, apiDeleteEntry, apiDuplicateEntry, apiPatchEntry } from '../api/entries'
import {
  bumpEntryContentRev,
  type EntryMeta,
  recentlyCreatedIds,
  removeEntry,
  upsertEntry,
} from '../canvas/state/entry-store'
import { saving } from './saving'

/** Create an entry (optimistic store insert on the server-returned row; undo soft-deletes it). */
export function createEntryCommand(input: CreateEntryInput): Command {
  let created: EntryMeta | null = null
  return {
    type: 'create-entry',
    labelKey: 'command.createEntry',
    do: async () => {
      await saving(async () => {
        if (created) {
          // Redo after an undo: restore the SAME soft-deleted row — re-creating would orphan the
          // trashed row and break the id that later stacked commands (content/tag/move) captured.
          await apiRestore(created.id)
          upsertEntry(created)
          bumpEntryContentRev(created.id)
        } else {
          created = await apiCreateEntry(input)
          recentlyCreatedIds.add(created.id)
          upsertEntry(created)
        }
      })
    },
    undo: async () => {
      if (created) {
        await apiDeleteEntry(created.id)
        removeEntry(created.id)
      }
    },
  }
}

/** Duplicate an entry (server creates an offset copy); undo soft-deletes the copy. */
export function duplicateEntryCommand(sourceId: string): Command {
  let created: EntryMeta | null = null
  return {
    type: 'duplicate-entry',
    labelKey: 'command.duplicate',
    do: async () => {
      await saving(async () => {
        if (created) {
          // Redo after an undo: restore the SAME row, not a fresh duplicate.
          await apiRestore(created.id)
          upsertEntry(created)
          bumpEntryContentRev(created.id)
        } else {
          created = await apiDuplicateEntry(sourceId)
          recentlyCreatedIds.add(created.id)
          upsertEntry(created)
        }
      })
    },
    undo: async () => {
      if (created) {
        await apiDeleteEntry(created.id)
        removeEntry(created.id)
      }
    },
  }
}

/** Move an entry (commits one undoable step per drag). `meta` is the pre-move snapshot. */
export function moveEntryCommand(
  meta: EntryMeta,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Command {
  return {
    type: 'move-entry',
    labelKey: 'command.moveEntry',
    do: async () => {
      upsertEntry({ ...meta, x: to.x, y: to.y })
      await saving(
        () => apiPatchEntry(meta.id, { x: to.x, y: to.y }),
        () => upsertEntry({ ...meta, x: from.x, y: from.y }),
      )
    },
    undo: async () => {
      upsertEntry({ ...meta, x: from.x, y: from.y })
      await saving(
        () => apiPatchEntry(meta.id, { x: from.x, y: from.y }),
        () => upsertEntry({ ...meta, x: to.x, y: to.y }),
      )
    },
  }
}

/** Toggle an entry's public/private visibility (undoable). */
export function setVisibilityCommand(meta: EntryMeta, to: 'public' | 'private'): Command {
  const from = meta.visibility
  return {
    type: 'set-visibility',
    labelKey: 'command.visibility',
    do: async () => {
      upsertEntry({ ...meta, visibility: to })
      await saving(
        () => apiPatchEntry(meta.id, { visibility: to }),
        () => upsertEntry({ ...meta, visibility: from }),
      )
    },
    undo: async () => {
      upsertEntry({ ...meta, visibility: from })
      await saving(
        () => apiPatchEntry(meta.id, { visibility: from }),
        () => upsertEntry({ ...meta, visibility: to }),
      )
    },
  }
}

/** Bring an entry to front / send to back by patching its z-index (undoable). */
export function setZIndexCommand(meta: EntryMeta, to: number): Command {
  const from = meta.zIndex
  return {
    type: 'set-zindex',
    labelKey: 'command.zindex',
    do: async () => {
      upsertEntry({ ...meta, zIndex: to })
      await saving(
        () => apiPatchEntry(meta.id, { zIndex: to }),
        () => upsertEntry({ ...meta, zIndex: from }),
      )
    },
    undo: async () => {
      upsertEntry({ ...meta, zIndex: from })
      await saving(
        () => apiPatchEntry(meta.id, { zIndex: from }),
        () => upsertEntry({ ...meta, zIndex: to }),
      )
    },
  }
}

/** Resize an entry (one undoable step per drag). `meta` is the pre-resize snapshot. */
export function resizeEntryCommand(
  meta: EntryMeta,
  from: { w: number; h: number },
  to: { w: number; h: number },
): Command {
  return {
    type: 'resize-entry',
    labelKey: 'command.resizeEntry',
    do: async () => {
      upsertEntry({ ...meta, w: to.w, h: to.h })
      await saving(
        () => apiPatchEntry(meta.id, { width: to.w, height: to.h }),
        () => upsertEntry({ ...meta, w: from.w, h: from.h }),
      )
    },
    undo: async () => {
      upsertEntry({ ...meta, w: from.w, h: from.h })
      await saving(
        () => apiPatchEntry(meta.id, { width: from.w, height: from.h }),
        () => upsertEntry({ ...meta, w: to.w, h: to.h }),
      )
    },
  }
}

interface ContentCommand extends Command {
  contentNext: unknown
}

/**
 * Edit an entry's content (save-on-blur / structured edit). Persists with a version snapshot and
 * bumps the content revision so the board entry re-fetches (making undo/redo visible without a
 * reload). Consecutive edits of the same entry coalesce into one undo step (keeping the original
 * `prev` and the latest `next`).
 */
export function updateEntryContentCommand(id: string, prev: unknown, next: unknown): Command {
  const cmd: ContentCommand = {
    type: 'update-content',
    labelKey: 'command.editContent',
    coalesceKey: `content:${id}`,
    contentNext: next,
    do: async () => {
      await saving(() => apiPatchEntry(id, { content: next, commitVersion: true }))
      bumpEntryContentRev(id)
    },
    undo: async () => {
      await saving(() => apiPatchEntry(id, { content: prev, commitVersion: true }))
      bumpEntryContentRev(id)
    },
    coalesce: (nextCmd) =>
      updateEntryContentCommand(id, prev, (nextCmd as ContentCommand).contentNext),
  }
  return cmd
}

/** Delete an entry; undo restores the same row (server trash restore) + refetches its content. */
export function deleteEntryCommand(meta: EntryMeta): Command {
  return {
    type: 'delete-entry',
    labelKey: 'command.deleteEntry',
    do: async () => {
      await saving(async () => {
        await apiDeleteEntry(meta.id)
        removeEntry(meta.id)
      })
    },
    undo: async () => {
      await apiRestore(meta.id)
      upsertEntry(meta)
      bumpEntryContentRev(meta.id)
    },
  }
}
