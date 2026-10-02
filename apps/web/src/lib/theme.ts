import { atom } from 'signia'

export type Theme = 'light' | 'dark' | 'win98'

const KEY = 'corkspace-theme'
const ORDER: Theme[] = ['light', 'dark', 'win98']

/** UI theme preference. localStorage is fine here — the "no localStorage" rule (docs/adr/)
 *  is scoped to canvas/board state, not user UI preferences. win98 is a retro theme (feedback). */
export const themeAtom = atom<Theme>('theme', 'light')

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'win98') {
      return saved
    }
  } catch {
    // private mode / unavailable — fall through to system preference
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function apply(t: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t)
  }
}

/** Read the saved/system theme and apply it (call once at startup, before first paint ideally). */
export function initTheme(): void {
  const t = initial()
  themeAtom.set(t)
  apply(t)
}

export function setTheme(t: Theme): void {
  themeAtom.set(t)
  apply(t)
  try {
    localStorage.setItem(KEY, t)
  } catch {
    // ignore persistence failures
  }
}

/** Cycle light → dark → win98 → light. */
export function toggleTheme(): void {
  const next = ORDER[(ORDER.indexOf(themeAtom.value) + 1) % ORDER.length] ?? 'light'
  setTheme(next)
}

const ICON: Record<Theme, string> = { light: '☀️', dark: '🌙', win98: '🖥️' }

export const themeIcon = (t: Theme): string => ICON[t]
