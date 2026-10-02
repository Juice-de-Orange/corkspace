import type { ReactNode } from 'react'
import { useT } from '../i18n'

/**
 * The board app header shell: keeps the load-bearing `app-header` class (drives z-index
 * `--z-header` so it + its dropdowns beat the canvas chrome, plus the win98 border-radius override)
 * and lays out a left slot (brand + optional board switcher) and a right slot (nav). Shared by the
 * authed Shell and the public read-only board so their headers never drift.
 */
export function AppHeader({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-side">{left}</div>
      <div className="app-header-side app-header-side-end">{right}</div>
    </header>
  )
}

/** The brand lockup: a pin glyph always, the wordmark hidden on very narrow viewports. */
export function AppBrand() {
  const t = useT()
  return (
    <span className="app-header-brand">
      <span aria-hidden="true">📌</span>
      <span className="app-header-brand-text">{t('shell.brand')}</span>
    </span>
  )
}
