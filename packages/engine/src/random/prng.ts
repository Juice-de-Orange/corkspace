/** Deterministic, seedable PRNG (mulberry32) — used for tilt + reproducible test sweeps. */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomInRange = (prng: () => number, min: number, max: number): number =>
  min + prng() * (max - min)

/** Stable 32-bit seed derived from a string (e.g. an entry id) via FNV-1a. */
export function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
