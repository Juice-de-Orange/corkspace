/**
 * Test/perf-only render instrumentation. Enabled under VITE_PERF or test mode; a no-op
 * (and effectively free) in production builds. The perf harness uses it to assert that a
 * camera pan triggers ZERO entry re-renders.
 */
const counts = new Map<string, number>()

const ENABLED =
  import.meta.env?.VITE_PERF === '1' ||
  import.meta.env?.VITE_PERF === 'true' ||
  import.meta.env?.MODE === 'test'

export function bumpRender(id: string): void {
  if (!ENABLED) {
    return
  }
  counts.set(id, (counts.get(id) ?? 0) + 1)
}

export function totalRenderCount(): number {
  let total = 0
  for (const n of counts.values()) {
    total += n
  }
  return total
}

export function resetRenderCounts(): void {
  counts.clear()
}
