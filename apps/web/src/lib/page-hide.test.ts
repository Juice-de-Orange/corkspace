import { afterEach, describe, expect, it, vi } from 'vitest'
import { queueEntryPatch, setPageHidden } from '../api/entry-save-queue'
import { installPageHideSave, onPageHide } from './page-hide'

installPageHideSave()

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  setVisibility('visible')
  setPageHidden(false)
})

describe('page-hide draft saving', () => {
  it('runs every registered draft saver when the tab is hidden and when the page closes', () => {
    const save = vi.fn()
    const off = onPageHide(save)
    setVisibility('hidden')
    expect(save).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenCalledTimes(2)
    off()
    window.dispatchEvent(new Event('pagehide'))
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('a draft saved on pagehide is sent with keepalive', async () => {
    const sent: boolean[] = []
    const off = onPageHide(() => {
      void queueEntryPatch('doc-1', { content: { doc: {} } }, async (_p, keepalive) => {
        sent.push(keepalive)
      })
    })
    window.dispatchEvent(new Event('pagehide'))
    off()
    await Promise.resolve()
    expect(sent).toEqual([true])
  })

  it('showing the page again switches keepalive off', async () => {
    const sent: boolean[] = []
    setVisibility('hidden')
    setVisibility('visible')
    await queueEntryPatch('doc-2', { x: 1 }, async (_p, keepalive) => {
      sent.push(keepalive)
    })
    expect(sent).toEqual([false])
  })
})
