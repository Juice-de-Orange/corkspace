import { MAX_TILT_DEG } from '@corkspace/shared/kernel'
import { createPrng, hashStringToSeed } from './prng'

/**
 * Deterministic slight tilt (degrees) for a new entry, in [-maxAbsDeg, +maxAbsDeg].
 * Stable per id so a re-render or reload reproduces the exact same angle.
 */
export function randomTiltDegrees(id: string | number, maxAbsDeg = MAX_TILT_DEG): number {
  const seed = typeof id === 'number' ? id >>> 0 : hashStringToSeed(id)
  const prng = createPrng(seed)
  return (prng() * 2 - 1) * maxAbsDeg
}
