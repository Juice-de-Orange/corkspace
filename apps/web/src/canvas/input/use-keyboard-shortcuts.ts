import { useEffect } from 'react'
import { deleteConnectionCommand } from '../../commands/connection-commands'
import { deleteEntryCommand, duplicateEntryCommand } from '../../commands/entry-commands'
import { history } from '../../history/history'
import { canEdit } from '../state/board-store'
import {
  connectAnchorAtom,
  connectDragAtom,
  connectHoverTargetAtom,
  connectionsAtom,
  connectSourceAnchorAtom,
  connectToolAtom,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from '../state/connection-store'
import { editingEntryIdAtom, setEditing } from '../state/editor-state'
import { entriesAtom } from '../state/entry-store'
import { clipboardIdAtom, selectedEntryIdAtom } from '../state/selection-state'
import { drawToolAtom } from '../state/stroke-store'

function inEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/** Global shortcuts: Escape (cancel edit / deselect / disarm tools), Delete/Backspace (trash the
 *  selected entry), undo/redo (Ctrl/Cmd+Z, +Shift / +Y) and copy/paste-duplicate (Ctrl/Cmd+C/V).
 *  Suppressed while a text field / editor is focused so it handles its own keys. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape: commit+close an open editor; else clear selection + disarm the active tool.
      if (e.key === 'Escape') {
        if (editingEntryIdAtom.value) {
          const ae = document.activeElement as HTMLElement | null
          ae?.blur?.() // triggers save-on-blur
          setEditing(null)
          return
        }
        if (drawToolAtom.value) {
          drawToolAtom.set(null)
        }
        if (connectToolAtom.value || pendingConnectFromAtom.value) {
          connectToolAtom.set(false)
          pendingConnectFromAtom.set(null)
          connectDragAtom.set(null)
          connectHoverTargetAtom.set(null)
          connectAnchorAtom.set(null)
          connectSourceAnchorAtom.set(null)
        }
        selectedEntryIdAtom.set(null)
        selectedConnectionIdAtom.set(null)
        return
      }

      // Delete/Backspace: remove the selected THREAD, else trash the selected entry —
      // never while typing / editing.
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !inEditable(e.target) &&
        !editingEntryIdAtom.value
      ) {
        const connId = selectedConnectionIdAtom.value
        const conn = connId ? connectionsAtom.value.get(connId) : undefined
        if (conn && canEdit()) {
          e.preventDefault()
          selectedConnectionIdAtom.set(null)
          void history.execute(deleteConnectionCommand(conn))
          return
        }
        const id = selectedEntryIdAtom.value
        const meta = id ? entriesAtom.value.get(id) : undefined
        if (meta && canEdit()) {
          e.preventDefault()
          selectedEntryIdAtom.set(null)
          void history.execute(deleteEntryCommand(meta))
        }
        return
      }

      if (!(e.ctrlKey || e.metaKey) || inEditable(e.target)) {
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'z') {
        e.preventDefault()
        void (e.shiftKey ? history.redo() : history.undo())
      } else if (k === 'y') {
        e.preventDefault()
        void history.redo()
      } else if (k === 'c') {
        const id = selectedEntryIdAtom.value
        if (id) {
          clipboardIdAtom.set(id)
        }
      } else if (k === 'v') {
        const id = clipboardIdAtom.value
        if (id) {
          e.preventDefault()
          void history.execute(duplicateEntryCommand(id))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
