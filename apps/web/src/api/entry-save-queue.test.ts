import type { PatchEntryInput } from '@corkspace/shared'
import { describe, expect, it } from 'vitest'
import { queueEntryPatch } from './entry-save-queue'

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

/** A fake server: records each request and lets the test decide when it answers. */
function fakeServer() {
  const requests: Array<{ patch: PatchEntryInput }> = []
  const answers: Array<ReturnType<typeof deferred<string>>> = []
  const send = (patch: PatchEntryInput) => {
    requests.push({ patch })
    const d = deferred<string>()
    answers.push(d)
    return d.promise
  }
  return { requests, answers, send }
}

describe('queueEntryPatch', () => {
  it('sends one request per entry at a time and the newest state last', async () => {
    const server = fakeServer()
    const a = queueEntryPatch('e1', { x: 1 }, server.send)
    const b = queueEntryPatch('e1', { x: 2 }, server.send)
    await flush()
    expect(server.requests.map((r) => r.patch)).toEqual([{ x: 1 }]) // second waits
    server.answers[0]?.resolve('first')
    expect(await a).toBe('first')
    await flush()
    expect(server.requests.map((r) => r.patch)).toEqual([{ x: 1 }, { x: 2 }])
    server.answers[1]?.resolve('second')
    expect(await b).toBe('second')
  })

  it('merges saves queued behind an in-flight one into a single request', async () => {
    const server = fakeServer()
    void queueEntryPatch('e2', { content: { text: 'a' } }, server.send)
    const b = queueEntryPatch('e2', { x: 5, commitVersion: true }, server.send)
    const c = queueEntryPatch('e2', { content: { text: 'abc' } }, server.send)
    server.answers[0]?.resolve('first')
    await flush()
    expect(server.requests).toHaveLength(2)
    expect(server.requests[1]?.patch).toEqual({
      x: 5,
      commitVersion: true,
      content: { text: 'abc' },
    })
    server.answers[1]?.resolve('merged')
    expect(await b).toBe('merged')
    expect(await c).toBe('merged')
  })

  it('a failed save rejects its callers but does not block the next save', async () => {
    const server = fakeServer()
    const a = queueEntryPatch('e3', { x: 1 }, server.send)
    const b = queueEntryPatch('e3', { x: 2 }, server.send)
    server.answers[0]?.reject(new Error('network'))
    await expect(a).rejects.toThrow('network')
    await flush()
    server.answers[1]?.resolve('next')
    expect(await b).toBe('next')
  })

  it('saves of different entries do not wait for each other', async () => {
    const server = fakeServer()
    void queueEntryPatch('e4', { x: 1 }, server.send)
    void queueEntryPatch('e5', { x: 1 }, server.send)
    await flush()
    expect(server.requests).toHaveLength(2)
    server.answers.forEach((d) => {
      d.resolve('ok')
    })
  })
})
