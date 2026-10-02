import type { ReactNode } from 'react'

interface PageShellProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Header actions (right side) — e.g. a back button. */
  actions?: ReactNode
  /** Constrain to a narrow single-column width (forms). */
  narrow?: boolean
  children: ReactNode
}

/** The standard full-page app surface: warm background, centered column, and a title/actions header. */
export function PageShell({ title, subtitle, actions, narrow, children }: PageShellProps) {
  return (
    <div className="page">
      <div className={`page-inner ${narrow ? 'page-inner-narrow' : ''}`}>
        <header className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  )
}
