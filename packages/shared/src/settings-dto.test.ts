import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  partialSettingsSchema,
  resolveEffectiveSettings,
  settingsSchema,
} from './settings-dto'

describe('resolveEffectiveSettings', () => {
  it('returns the compiled base when both stores are empty', () => {
    expect(resolveEffectiveSettings(null, null)).toEqual(DEFAULT_SETTINGS)
    expect(resolveEffectiveSettings({}, {})).toEqual(DEFAULT_SETTINGS)
  })

  it('lets a board override win over the global default and the base', () => {
    const eff = resolveEffectiveSettings({ background: 'paper' }, { background: 'linen' })
    expect(eff.background).toBe('linen')
  })

  it('falls back to the global default when the board has no override', () => {
    const eff = resolveEffectiveSettings({ background: 'paper' }, {})
    expect(eff.background).toBe('paper')
  })

  it('deep-merges nested font-size groups (per-key, later wins)', () => {
    const eff = resolveEffectiveSettings({ fontSizes: { sticky: 48 } }, { fontSizes: { doc: 40 } })
    expect(eff.fontSizes.sticky).toBe(48) // from global
    expect(eff.fontSizes.doc).toBe(40) // from board
    expect(eff.fontSizes.checklist).toBe(DEFAULT_SETTINGS.fontSizes.checklist) // from base
  })

  it('deep-merges nested font-family groups', () => {
    const eff = resolveEffectiveSettings(undefined, { fonts: { sticky: 'serif' } })
    expect(eff.fonts.sticky).toBe('serif')
    expect(eff.fonts.doc).toBe(DEFAULT_SETTINGS.fonts.doc)
  })

  it('applies global-level font/size overrides when the board has none', () => {
    const eff = resolveEffectiveSettings({ fonts: { doc: 'mono' }, fontSizes: { link: 40 } }, {})
    expect(eff.fonts.doc).toBe('mono')
    expect(eff.fontSizes.link).toBe(40)
    expect(eff.fonts.sticky).toBe(DEFAULT_SETTINGS.fonts.sticky)
  })

  it('produces a value that satisfies the full settings schema', () => {
    expect(settingsSchema.safeParse(resolveEffectiveSettings({}, {})).success).toBe(true)
  })
})

describe('partialSettingsSchema', () => {
  it('accepts a sparse override', () => {
    expect(partialSettingsSchema.safeParse({ fontSizes: { sticky: 50 } }).success).toBe(true)
  })
  it('rejects unknown keys and out-of-range sizes', () => {
    expect(partialSettingsSchema.safeParse({ nope: 1 }).success).toBe(false)
    expect(partialSettingsSchema.safeParse({ fontSizes: { sticky: 5 } }).success).toBe(false)
    expect(partialSettingsSchema.safeParse({ background: 'neon' }).success).toBe(false)
  })
})
