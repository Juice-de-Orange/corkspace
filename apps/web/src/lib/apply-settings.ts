import { FONTS, type FontKey, type Settings } from '@corkspace/shared'

/** Map a curated font slot to a CSS font-family stack. */
const FONT_FAMILY: Record<FontKey, string> = {
  serif: `'${FONTS.serif}', Georgia, serif`,
  sans: `'${FONTS.sans}', ui-sans-serif, system-ui`,
  mono: `'${FONTS.mono}', ui-monospace, monospace`,
  hand: `'${FONTS.hand}', ui-sans-serif, system-ui`,
}

/**
 * Write the board's effective appearance settings to CSS custom properties on <html>, so every
 * entry reads its font + size from a var (the board owner's choice, inheriting the global default).
 * Background is applied via the existing `data-bg` mechanism.
 */
export function applySettings(s: Settings): void {
  const root = document.documentElement
  root.setAttribute('data-bg', s.background)
  const fs = s.fontSizes
  root.style.setProperty('--sticky-fs', `${fs.sticky}px`)
  root.style.setProperty('--doc-fs', `${fs.doc}px`)
  root.style.setProperty('--checklist-fs', `${fs.checklist}px`)
  root.style.setProperty('--link-fs', `${fs.link}px`)
  root.style.setProperty('--sticky-font', FONT_FAMILY[s.fonts.sticky])
  root.style.setProperty('--doc-font', FONT_FAMILY[s.fonts.doc])
  root.style.setProperty('--checklist-font', FONT_FAMILY[s.fonts.checklist])
  root.style.setProperty('--link-font', FONT_FAMILY[s.fonts.link])
}
