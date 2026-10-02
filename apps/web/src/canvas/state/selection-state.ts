import { atom } from 'signia'

/** Last-clicked entry (single selection). */
export const selectedEntryIdAtom = atom<string | null>('selectedEntryId', null)
/** Entry id held for paste/duplicate (Ctrl+C → Ctrl+V). */
export const clipboardIdAtom = atom<string | null>('clipboardId', null)
