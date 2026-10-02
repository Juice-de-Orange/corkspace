import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name — required (icon buttons have no visible text). Also used as the tooltip. */
  label: string
  size?: 'sm' | 'md'
  /** Visual style: a bordered ghost (default) or a bare glyph. */
  variant?: 'ghost' | 'bare'
  children: ReactNode
}

/**
 * An icon-only button that CANNOT be created without an accessible name — every emoji/glyph control
 * routes through here so screen readers always have a label (a recurring a11y gap in the old inline
 * buttons). Wraps the shared `.btn` system.
 */
export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  type = 'button',
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  // A "bare" icon button is just the base .btn (transparent) without the ghost border/fill.
  const cls = [
    'btn',
    variant === 'ghost' ? 'btn-ghost' : '',
    'btn-icon',
    size === 'sm' ? 'btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
