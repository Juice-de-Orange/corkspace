import type { LocalizedLabel } from '@corkspace/shared'
import { useValue } from 'signia-react'
import { langAtom } from './lang'
import { MESSAGES, type MessageKey } from './messages'

/**
 * Translate a key in the current language, interpolating `{name}` placeholders. Safe to call from
 * non-component code (commands, toast helpers) — it reads the current language at call time.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = MESSAGES[key]
  let s: string = msg ? msg[langAtom.value] : key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v))
    }
  }
  return s
}

/**
 * Hook form: subscribes the calling component to language changes so it re-renders on toggle, and
 * returns the same `t`. Use `useT()` in components; use bare `t()` in imperative code (commands).
 */
export function useT(): typeof t {
  useValue(langAtom)
  return t
}

/** Pick the current language from a bilingual label (the `@corkspace/shared` UI-label maps). */
export function localized(label: LocalizedLabel): string {
  return label[langAtom.value]
}

/** BCP 47 locale for dates and numbers in the current UI language. */
export function dateLocale(): string {
  return langAtom.value === 'de' ? 'de-DE' : 'en-GB'
}
