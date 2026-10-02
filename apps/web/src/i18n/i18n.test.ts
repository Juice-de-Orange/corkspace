import { afterEach, describe, expect, it } from 'vitest'
import { langAtom, setLang } from './lang'
import { MESSAGES } from './messages'
import { admin } from './messages/admin'
import { auth } from './messages/auth'
import { boards } from './messages/boards'
import { canvas } from './messages/canvas'
import { commands } from './messages/commands'
import { common } from './messages/common'
import { forms } from './messages/forms'
import { shell } from './messages/shell'
import { toolbar } from './messages/toolbar'
import { t } from './t'

const NAMESPACES = [common, auth, shell, toolbar, canvas, boards, admin, forms, commands]

describe('i18n catalog', () => {
  const original = langAtom.value
  afterEach(() => setLang(original))

  it('every message has a non-empty de and en string', () => {
    for (const [key, msg] of Object.entries(MESSAGES)) {
      expect(msg.de, `${key}.de`).toBeTruthy()
      expect(msg.en, `${key}.en`).toBeTruthy()
    }
  })

  it('has no duplicate keys across namespaces (a merge collision would drop one silently)', () => {
    const summed = NAMESPACES.reduce<number>((sum, ns) => sum + Object.keys(ns).length, 0)
    expect(Object.keys(MESSAGES).length).toBe(summed)
  })

  it('t() resolves the current language and follows setLang', () => {
    setLang('de')
    expect(t('common.cancel')).toBe('Abbrechen')
    setLang('en')
    expect(t('common.cancel')).toBe('Cancel')
  })

  it('t() interpolates every {param} placeholder', () => {
    setLang('de')
    const entry = Object.entries(MESSAGES).find(([, m]) => /\{[a-z]+\}/i.test(m.de))
    if (!entry) return // no interpolated messages yet — nothing to assert
    const [key, msg] = entry
    const params: Record<string, string> = {}
    for (const m of msg.de.matchAll(/\{([a-z]+)\}/gi)) {
      if (m[1]) {
        params[m[1]] = 'X'
      }
    }
    const out = t(key as Parameters<typeof t>[0], params)
    expect(out).not.toMatch(/\{[a-z]+\}/i)
  })
})
