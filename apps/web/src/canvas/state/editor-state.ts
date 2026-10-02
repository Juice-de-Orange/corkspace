import { atom } from 'signia'
import { canEdit } from './board-store'

/** The single entry currently being edited (enforces the single-live-editor invariant). */
export const editingEntryIdAtom = atom<string | null>('editingEntryId', null)

export function setEditing(id: string | null): void {
  // Read-only (viewer / external link): never enter edit mode.
  if (id !== null && !canEdit()) {
    return
  }
  editingEntryIdAtom.set(id)
}
