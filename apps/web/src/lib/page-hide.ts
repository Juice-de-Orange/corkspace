import { sendQueuedSavesNow, setPageHidden } from '../api/entry-save-queue'

/**
 * Save what is still being edited when the page is hidden or closed (#9). Open editors register a
 * draft saver that persists their current text without closing the editor; the entry save queue
 * sends those saves (and any queued ones) with `keepalive`, so they complete after the tab is gone.
 */
const draftSavers = new Set<() => void>()

/** Register a draft saver for as long as an editor is open; returns the unregister function. */
export function onPageHide(saveDraft: () => void): () => void {
  draftSavers.add(saveDraft)
  return () => {
    draftSavers.delete(saveDraft)
  }
}

function hide(closing: boolean): void {
  setPageHidden(true)
  for (const save of draftSavers) {
    save()
  }
  if (closing) {
    sendQueuedSavesNow()
  }
}

/** Install the listeners once at start-up. */
export function installPageHideSave(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hide(false)
    } else {
      setPageHidden(false)
    }
  })
  window.addEventListener('pagehide', () => hide(true))
  window.addEventListener('pageshow', () => setPageHidden(false))
}
