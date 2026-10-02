import { useEffect, useState } from 'react'

function match(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

/**
 * Track a CSS media query. Initialized synchronously from matchMedia so the first render already
 * reflects the real viewport (no layout flash / e2e flake), then updates on change. Degrades to
 * `false` where matchMedia is unavailable (e.g. the jsdom perf/unit env).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => match(query))
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}
