import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n'
import { IconButton } from './IconButton'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Optional footer (action buttons). */
  footer?: ReactNode
  /** Max width in px (default 480). */
  maxWidth?: number
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal dialog: rendered in a portal, focus-trapped, Escape- and backdrop-dismissable,
 * `aria-modal` + labelled by its title, and restores focus to the trigger on close. The shared base
 * for every dialog/panel that needs to steal focus (replaces the ad-hoc overlays + native dialogs).
 */
export function Modal({ open, onClose, title, children, footer, maxWidth = 480 }: ModalProps) {
  const tr = useT()
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    restoreRef.current = document.activeElement as HTMLElement | null
    const node = ref.current
    // Focus the first focusable element (or the dialog itself).
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !node) {
        return
      }
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (!firstEl || !lastEl) {
        e.preventDefault()
        return
      }
      const active = document.activeElement
      if (e.shiftKey && active === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) {
    return null
  }
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop-click is a mouse convenience; Escape (handled above) + the close button are the accessible dismiss paths
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <IconButton label={tr('common.close')} size="sm" onClick={onClose}>
            ✕
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
