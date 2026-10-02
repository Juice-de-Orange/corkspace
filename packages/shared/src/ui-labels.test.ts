import { describe, expect, it } from 'vitest'
import { ENTRY_TYPES, STICKY_COLORS } from './kernel/constants'
import { BACKGROUNDS, FONT_KEYS } from './settings-dto'
import {
  BACKGROUND_LABEL,
  ENTRY_TYPE_COLOR,
  ENTRY_TYPE_LABEL,
  FONT_LABEL,
  STICKY_COLOR_LABEL,
} from './ui-labels'

describe('ui-labels', () => {
  it('has a label + colour for every entry type (no missing / extra keys)', () => {
    expect(Object.keys(ENTRY_TYPE_LABEL).sort()).toEqual([...ENTRY_TYPES].sort())
    expect(Object.keys(ENTRY_TYPE_COLOR).sort()).toEqual([...ENTRY_TYPES].sort())
  })

  it('has a label for every background, font and sticky colour', () => {
    expect(Object.keys(BACKGROUND_LABEL).sort()).toEqual([...BACKGROUNDS].sort())
    expect(Object.keys(FONT_LABEL).sort()).toEqual([...FONT_KEYS].sort())
    expect(Object.keys(STICKY_COLOR_LABEL).sort()).toEqual([...STICKY_COLORS].sort())
  })

  it('entry-type colours are distinct hex values', () => {
    const values = Object.values(ENTRY_TYPE_COLOR)
    expect(new Set(values).size).toBe(values.length)
    for (const v of values) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
