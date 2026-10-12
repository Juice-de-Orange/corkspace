export interface RateLimitResult {
  ok: boolean
  /** Seconds until the caller's window ends (only meaningful when `ok` is false). */
  retryAfterSeconds: number
}

/**
 * In-memory fixed-window counter per key (the client IP). One api process serves the demo, so a
 * process-local table is enough. The table is bounded: expired windows are dropped once it reaches
 * `maxKeys`, and if every slot still holds a live window, unknown keys are refused (fail closed)
 * instead of letting a flood of fresh addresses grow memory.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 50_000,
  ) {}

  get size(): number {
    return this.windows.size
  }

  hit(key: string): RateLimitResult {
    const now = this.now()
    let w = this.windows.get(key)
    if (!w || w.resetAt <= now) {
      if (!w && this.windows.size >= this.maxKeys) {
        this.dropExpired(now)
        if (this.windows.size >= this.maxKeys) {
          return {
            ok: false,
            retryAfterSeconds: Math.ceil(this.windowMs / 1000),
          }
        }
      }
      w = { count: 0, resetAt: now + this.windowMs }
      this.windows.set(key, w)
    }
    w.count += 1
    return {
      ok: w.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
    }
  }

  private dropExpired(now: number): void {
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) {
        this.windows.delete(key)
      }
    }
  }
}
