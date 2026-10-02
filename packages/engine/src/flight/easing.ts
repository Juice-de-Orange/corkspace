export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

export const easeOutCubic = (t: number): number => {
  const x = clamp01(t)
  return 1 - (1 - x) ** 3
}

export const easeInCubic = (t: number): number => {
  const x = clamp01(t)
  return x * x * x
}
