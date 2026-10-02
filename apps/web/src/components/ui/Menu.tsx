import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

interface MenuProps {
  /** Content of the trigger button. */
  triggerContent: ReactNode
  /** Menu items — receives `close` so an item can dismiss the menu after acting. */
  children: (close: () => void) => ReactNode
  /** Accessible name for the trigger (required for icon-only triggers). */
  triggerLabel: string
  triggerClassName?: string
  /** Which edge the popover aligns to. */
  align?: 'left' | 'right'
  /** Open the popover below (default) or above the trigger — 'up' for a bottom-anchored toolbar. */
  direction?: 'down' | 'up'
}

/**
 * A headless dropdown: a trigger button that toggles a `.menu` popover, closing on outside-click,
 * Escape, or blur. Tap-reachable (fixes the old hover-only menus) and keyboard-operable. Used for
 * the board switcher and the responsive header overflow menu.
 */
export function Menu({
  triggerContent,
  children,
  triggerLabel,
  triggerClassName = 'btn btn-ghost',
  align = 'left',
  direction = 'down',
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) {
      return
    }
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerContent}
      </button>
      {open ? (
        <div
          id={menuId}
          className="menu"
          style={{
            position: 'absolute',
            ...(direction === 'up' ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
            [align]: 0,
          }}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  )
}
