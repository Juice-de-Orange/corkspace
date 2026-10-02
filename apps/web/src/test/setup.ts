import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom doesn't implement matchMedia; provide a no-match stub so responsive hooks (useMediaQuery)
// render their desktop branch in component tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

afterEach(() => {
  cleanup()
})
