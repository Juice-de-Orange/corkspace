import { type RefObject, useEffect } from 'react'
import { createImageFromFile } from '../../commands/image'
import { t } from '../../i18n'
import { pushError } from '../state/toast-store'

/** Create image entries by dropping image files onto the board, or pasting an image. */
export function useImageDropPaste(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) {
        const rect = root.getBoundingClientRect()
        void createImageFromFile(file, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        }).catch(() => pushError(t('cmd.imageAddFailed')))
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) {
        void createImageFromFile(file).catch(() => pushError(t('cmd.imageAddFailed')))
      }
    }

    root.addEventListener('dragover', onDragOver)
    root.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      root.removeEventListener('dragover', onDragOver)
      root.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [rootRef])
}
