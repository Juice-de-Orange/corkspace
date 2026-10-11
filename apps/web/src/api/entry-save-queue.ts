import type { PatchEntryInput } from '@corkspace/shared'

/**
 * Per-entry save queue.
 *
 * Saves of one entry go out one at a time and in call order (#6): a save is sent only after the
 * previous save of the same entry has settled (succeeded or failed). The server is last-write-wins,
 * so without this two quick edits could overtake each other on the wire and the older state would
 * be the one kept. Saves queued behind an in-flight one are merged into a single request (the later
 * value of a field wins), so a burst of edits costs at most two round trips. Different entries still
 * save in parallel.
 */

/** Sends one PATCH. */
export type SendPatch<T> = (patch: PatchEntryInput) => Promise<T>

interface Job {
  patch: PatchEntryInput
  send: SendPatch<unknown>
  waiters: Array<{ resolve: (value: unknown) => void; reject: (error: unknown) => void }>
}

interface Slot {
  busy: boolean
  next: Job | null
}

const slots = new Map<string, Slot>()

/** Merge a later patch into an earlier one: later defined fields win, a version is kept if asked. */
function mergePatches(earlier: PatchEntryInput, later: PatchEntryInput): PatchEntryInput {
  const merged: Record<string, unknown> = { ...earlier }
  for (const [key, value] of Object.entries(later)) {
    if (value !== undefined) {
      merged[key] = value
    }
  }
  if (earlier.commitVersion || later.commitVersion) {
    merged.commitVersion = true
  }
  return merged as PatchEntryInput
}

async function run(job: Job): Promise<void> {
  try {
    const result = await job.send(job.patch)
    for (const w of job.waiters) {
      w.resolve(result)
    }
  } catch (e) {
    for (const w of job.waiters) {
      w.reject(e)
    }
  }
}

async function drain(id: string, slot: Slot): Promise<void> {
  slot.busy = true
  while (slot.next) {
    const job = slot.next
    slot.next = null
    await run(job)
  }
  slot.busy = false
  slots.delete(id)
}

/** Queue a save of entry `id`. Resolves with the response of the request that carried it. */
export function queueEntryPatch<T>(
  id: string,
  patch: PatchEntryInput,
  send: SendPatch<T>,
): Promise<T> {
  let slot = slots.get(id)
  if (!slot) {
    slot = { busy: false, next: null }
    slots.set(id, slot)
  }
  const target = slot
  return new Promise<T>((resolve, reject) => {
    const waiter = { resolve: (v: unknown) => resolve(v as T), reject }
    if (target.next) {
      target.next.patch = mergePatches(target.next.patch, patch)
      target.next.waiters.push(waiter)
    } else {
      target.next = { patch, send: send as SendPatch<unknown>, waiters: [waiter] }
    }
    if (!target.busy) {
      void drain(id, target)
    }
  })
}
