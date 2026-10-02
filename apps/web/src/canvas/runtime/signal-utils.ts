import type { Atom } from 'signia'

/**
 * Read an atom purely to register it as a reactive dependency of the enclosing `react()`
 * effect. Returns the value (so it is not a bare expression) but callers ignore it.
 */
export function depend<T>(a: Atom<T, unknown>): T {
  return a.value
}
