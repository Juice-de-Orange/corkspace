import { describe, expect, it } from 'vitest'
import { history } from '../../history/history'
import {
  connectDragAtom,
  connectToolAtom,
  pendingConnectFromAtom,
  selectedConnectionIdAtom,
} from './connection-store'
import { editingEntryIdAtom } from './editor-state'
import {
  bumpEntryContentRev,
  entryContentRevAtom,
  recentlyCreatedIds,
  stickyTextCache,
} from './entry-store'
import { resetBoardClientState } from './reset-board'
import { clipboardIdAtom, selectedEntryIdAtom } from './selection-state'
import { drawToolAtom } from './stroke-store'

describe('resetBoardClientState', () => {
  it('clears the undo history so a board/account switch cannot replay the previous tenant’s commands', async () => {
    let undone = false
    await history.execute({
      type: 'noop',
      do: async () => {},
      // A leaked replay of this would inject a foreign entry into the new board.
      undo: async () => {
        undone = true
      },
    })
    expect(history.canUndo()).toBe(true)

    resetBoardClientState()

    expect(history.canUndo()).toBe(false)
    expect(await history.undo()).toBe(false)
    expect(undone).toBe(false)
  })

  it('clears transient selection / editing / connect / clipboard state and recentlyCreatedIds', () => {
    selectedEntryIdAtom.set('foreign-entry')
    selectedConnectionIdAtom.set('foreign-conn')
    editingEntryIdAtom.set('foreign-entry')
    clipboardIdAtom.set('foreign-entry')
    pendingConnectFromAtom.set('foreign-entry')
    connectDragAtom.set({ fromId: 'foreign-entry', x: 0, y: 0 })
    recentlyCreatedIds.add('foreign-entry')

    resetBoardClientState()

    expect(selectedEntryIdAtom.value).toBeNull()
    expect(selectedConnectionIdAtom.value).toBeNull()
    expect(editingEntryIdAtom.value).toBeNull()
    expect(clipboardIdAtom.value).toBeNull()
    expect(pendingConnectFromAtom.value).toBeNull()
    expect(connectDragAtom.value).toBeNull()
    expect(recentlyCreatedIds.size).toBe(0)
  })

  it('disarms the connect and draw tools so they do not carry over to the next board (#8)', () => {
    connectToolAtom.set(true)
    drawToolAtom.set('pen')

    resetBoardClientState()

    expect(connectToolAtom.value).toBe(false)
    expect(drawToolAtom.value).toBeNull()
  })

  it('clears the per-entry content caches instead of growing them for the whole session (#8)', () => {
    stickyTextCache.set('foreign-sticky', { rev: 0, text: 'from the previous board' })
    bumpEntryContentRev('foreign-sticky')

    resetBoardClientState()

    expect(stickyTextCache.size).toBe(0)
    expect(entryContentRevAtom.value.size).toBe(0)
  })
})
