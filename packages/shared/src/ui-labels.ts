import type { EntryType, StickyColor } from './kernel/constants'
import type { Background, FontKey } from './settings-dto'

/**
 * Human-facing display labels + the single entry-type colour palette, centralized so raw
 * identifiers (`sticky`, `cork-photo`, `serif`…) never leak into the UI and every surface (Account,
 * Admin, Minimap, GraphView, toolbars) speaks the same words and colours. Every label carries both
 * UI languages; the web app picks one with `localized()` from its i18n module.
 */

export interface LocalizedLabel {
  de: string
  en: string
}

export const ENTRY_TYPE_LABEL: Record<EntryType, LocalizedLabel> = {
  sticky: { de: 'Notiz', en: 'Note' },
  doc: { de: 'Dokument', en: 'Document' },
  checklist: { de: 'Checkliste', en: 'Checklist' },
  image: { de: 'Bild', en: 'Image' },
  link: { de: 'Link-Karte', en: 'Link card' },
}

/** One cohesive, Majorelle-harmonized palette per entry type — used by the minimap AND the graph
 *  (replaces the two divergent local palettes). Sticky notes still render their own chosen colour. */
export const ENTRY_TYPE_COLOR: Record<EntryType, string> = {
  sticky: '#eeb115',
  doc: '#6a5cf0',
  checklist: '#2ea16f',
  image: '#3f97d3',
  link: '#c256c9',
}

export const BACKGROUND_LABEL: Record<Background, LocalizedLabel> = {
  'cork-photo': { de: 'Kork (Foto)', en: 'Cork (photo)' },
  'cork-classic': { de: 'Kork (klassisch)', en: 'Cork (classic)' },
  paper: { de: 'Papier', en: 'Paper' },
  linen: { de: 'Leinen', en: 'Linen' },
  sky: { de: 'Himmelblau', en: 'Sky blue' },
  mint: { de: 'Minze', en: 'Mint' },
  sun: { de: 'Sonnengelb', en: 'Sunshine yellow' },
  coral: { de: 'Koralle', en: 'Coral' },
}

export const FONT_LABEL: Record<FontKey, LocalizedLabel> = {
  serif: { de: 'Serif · Source Serif', en: 'Serif · Source Serif' },
  sans: { de: 'Sans · Inter', en: 'Sans · Inter' },
  mono: { de: 'Mono · JetBrains', en: 'Mono · JetBrains' },
  hand: { de: 'Handschrift · Caveat', en: 'Handwriting · Caveat' },
}

export const STICKY_COLOR_LABEL: Record<StickyColor, LocalizedLabel> = {
  yellow: { de: 'Gelb', en: 'Yellow' },
  pink: { de: 'Rosa', en: 'Pink' },
  blue: { de: 'Blau', en: 'Blue' },
  green: { de: 'Grün', en: 'Green' },
  orange: { de: 'Orange', en: 'Orange' },
  purple: { de: 'Lila', en: 'Purple' },
}
