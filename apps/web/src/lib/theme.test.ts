import { beforeEach, describe, expect, it } from 'vitest'
import { initTheme, setTheme, themeAtom, toggleTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    themeAtom.set('light')
  })

  it('initTheme defaults to light with nothing saved (jsdom has no matchMedia)', () => {
    initTheme()
    expect(themeAtom.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setTheme applies the attribute and persists', () => {
    setTheme('dark')
    expect(themeAtom.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('corkspace-theme')).toBe('dark')
  })

  it('toggleTheme cycles light → dark → win98 → light', () => {
    setTheme('light')
    toggleTheme()
    expect(themeAtom.value).toBe('dark')
    toggleTheme()
    expect(themeAtom.value).toBe('win98')
    toggleTheme()
    expect(themeAtom.value).toBe('light')
  })

  it('initTheme restores a saved preference', () => {
    localStorage.setItem('corkspace-theme', 'dark')
    initTheme()
    expect(themeAtom.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
