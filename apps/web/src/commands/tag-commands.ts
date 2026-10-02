import type { Command } from '@corkspace/engine'
import type { TagStyle } from '@corkspace/shared'
import { apiCreateTag, apiDeleteTag, apiSetEntryTags, type Tag } from '../api/tags'
import { entriesAtom, upsertEntry } from '../canvas/state/entry-store'
import { removeTag, upsertTag } from '../canvas/state/tag-store'
import { saving } from './saving'

/** Create a tag (server-side); undo deletes it, redo re-creates it. */
export function createTagCommand(input: {
  name: string
  color: string
  styleRules?: TagStyle
}): Command {
  let created: Tag | null = null
  return {
    type: 'create-tag',
    labelKey: 'command.createTag',
    do: async () => {
      created = await apiCreateTag(input)
      upsertTag(created)
    },
    undo: async () => {
      if (created) {
        await apiDeleteTag(created.id)
        removeTag(created.id)
      }
    },
  }
}

/** Replace an entry's tag set (optimistic store update + atomic server assign); reversible. On a
 *  server failure the optimistic chip change is rolled back and an error toast is shown (via
 *  `saving`) so the store never silently diverges from the DB. */
export function assignTagsCommand(entryId: string, from: string[], to: string[]): Command {
  const setLocal = (ids: string[]): void => {
    const meta = entriesAtom.value.get(entryId)
    if (meta) {
      upsertEntry({ ...meta, tagIds: ids })
    }
  }
  const apply = (ids: string[], revert: string[]): Promise<void> => {
    setLocal(ids)
    return saving(
      () => apiSetEntryTags(entryId, ids),
      () => setLocal(revert),
    )
  }
  return {
    type: 'assign-tags',
    labelKey: 'command.assignTags',
    do: () => apply(to, from),
    undo: () => apply(from, to),
  }
}
