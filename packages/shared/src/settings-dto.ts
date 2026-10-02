import { z } from 'zod'
import { STICKY_COLORS } from './kernel/index'

/**
 * Per-board appearance settings (M3). Two stores merge into the effective settings a board renders
 * with: the GLOBAL defaults (super-admin, `app_settings.defaults`) and the per-board sparse
 * overrides (`boards.settings`). `resolveEffectiveSettings` is pure + unit-tested. Theme (light/
 * dark) and language are NOT here — they stay per-viewer client prefs.
 */

/** Board backgrounds (aligned with the `data-bg` keys in the web app): four textures + four
 *  bright solid colours (requested in user feedback). */
export const BACKGROUNDS = [
  'cork-photo',
  'cork-classic',
  'paper',
  'linen',
  'sky',
  'mint',
  'sun',
  'coral',
] as const
export type Background = (typeof BACKGROUNDS)[number]

/** Font slots — keys into the curated FONTS map. */
export const FONT_KEYS = ['serif', 'sans', 'mono', 'hand'] as const
export type FontKey = (typeof FONT_KEYS)[number]

const backgroundEnum = z.enum(BACKGROUNDS)
const fontKeyEnum = z.enum(FONT_KEYS)
const stickyColorEnum = z.enum(STICKY_COLORS)
const fontSize = z.number().int().min(8).max(200)

const fontsSchema = z
  .object({ sticky: fontKeyEnum, doc: fontKeyEnum, checklist: fontKeyEnum, link: fontKeyEnum })
  .strict()
const fontSizesSchema = z
  .object({ sticky: fontSize, doc: fontSize, checklist: fontSize, link: fontSize })
  .strict()

/** A fully-populated settings object (the effective result). */
export const settingsSchema = z
  .object({
    background: backgroundEnum,
    stickyDefaultColor: stickyColorEnum,
    fonts: fontsSchema,
    fontSizes: fontSizesSchema,
  })
  .strict()
export type Settings = z.infer<typeof settingsSchema>

/** Sparse overrides (per-board or global). Every field — including nested — is optional. */
export const partialSettingsSchema = z
  .object({
    background: backgroundEnum.optional(),
    stickyDefaultColor: stickyColorEnum.optional(),
    fonts: fontsSchema.partial().strict().optional(),
    fontSizes: fontSizesSchema.partial().strict().optional(),
  })
  .strict()
export type PartialSettings = z.infer<typeof partialSettingsSchema>

/** The compiled-in base — matches the current hard-coded look. */
export const DEFAULT_SETTINGS: Settings = {
  background: 'cork-photo',
  stickyDefaultColor: 'yellow',
  fonts: { sticky: 'hand', doc: 'serif', checklist: 'sans', link: 'sans' },
  fontSizes: { sticky: 60, doc: 30, checklist: 28, link: 26 },
}

/** Deep-merge global defaults then per-board overrides over the compiled base. Pure. */
export function resolveEffectiveSettings(
  globalDefaults: PartialSettings | null | undefined,
  boardOverrides: PartialSettings | null | undefined,
): Settings {
  const g = globalDefaults ?? {}
  const b = boardOverrides ?? {}
  const base = DEFAULT_SETTINGS
  return {
    background: b.background ?? g.background ?? base.background,
    stickyDefaultColor: b.stickyDefaultColor ?? g.stickyDefaultColor ?? base.stickyDefaultColor,
    fonts: {
      sticky: b.fonts?.sticky ?? g.fonts?.sticky ?? base.fonts.sticky,
      doc: b.fonts?.doc ?? g.fonts?.doc ?? base.fonts.doc,
      checklist: b.fonts?.checklist ?? g.fonts?.checklist ?? base.fonts.checklist,
      link: b.fonts?.link ?? g.fonts?.link ?? base.fonts.link,
    },
    fontSizes: {
      sticky: b.fontSizes?.sticky ?? g.fontSizes?.sticky ?? base.fontSizes.sticky,
      doc: b.fontSizes?.doc ?? g.fontSizes?.doc ?? base.fontSizes.doc,
      checklist: b.fontSizes?.checklist ?? g.fontSizes?.checklist ?? base.fontSizes.checklist,
      link: b.fontSizes?.link ?? g.fontSizes?.link ?? base.fontSizes.link,
    },
  }
}
