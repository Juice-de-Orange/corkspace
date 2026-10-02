type FrameCb = () => void

let pending: Set<FrameCb> | null = null
let rafId: number | null = null

function flush(): void {
  const cbs = pending
  pending = null
  rafId = null
  if (cbs) {
    for (const cb of cbs) {
      cb()
    }
  }
}

/** Coalesce work into a single requestAnimationFrame (deduped per callback). */
export function scheduleFrame(cb: FrameCb): void {
  if (!pending) {
    pending = new Set()
  }
  pending.add(cb)
  if (rafId == null) {
    rafId = requestAnimationFrame(flush)
  }
}

/** Test helper: run the pending frame synchronously (deterministic perf assertions). */
export function flushFrameSync(): void {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
  }
  flush()
}
