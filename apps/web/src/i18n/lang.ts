import { atom } from 'signia'

export type Lang = 'de' | 'en'

const KEY = 'corkspace-lang'

/** UI language preference. localStorage is fine here — the "no localStorage" rule is scoped to
 *  canvas/board state, not user UI preferences (mirrors `lib/theme.ts`). Default English; German
 *  via the toggle or a `de*` browser language. */
export const langAtom = atom<Lang>('lang', 'en')

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'de' || saved === 'en') {
      return saved
    }
  } catch {
    // private mode / unavailable — fall through to navigator / default
  }
  if (typeof navigator !== 'undefined' && /^de\b/i.test(navigator.language)) {
    return 'de'
  }
  return 'en'
}

function apply(l: Lang): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', l)
  }
}

/** Read the saved/navigator language and apply it to <html lang> (call once at startup). */
export function initLang(): void {
  const l = initial()
  langAtom.set(l)
  apply(l)
}

export function setLang(l: Lang): void {
  langAtom.set(l)
  apply(l)
  try {
    localStorage.setItem(KEY, l)
  } catch {
    // ignore persistence failures
  }
}

/** Toggle DE ↔ EN. */
export function toggleLang(): void {
  setLang(langAtom.value === 'de' ? 'en' : 'de')
}

const ICON: Record<Lang, string> = { de: '🇩🇪', en: '🇬🇧' }

/** Flag of the CURRENT language (shown on the toggle button). */
export const langIcon = (l: Lang): string => ICON[l]
