import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCurrentBoard, setPublicToken } from './board-context'
import { loadEntryContent } from './entry-content-loader'

interface Call {
  method: string
  url: string
  ids?: string[]
}

/** A fake api: records each request and answers with the next scripted response (default: every
 *  asked id's content is `{ text: <id> }`). */
function fakeApi() {
  const calls: Call[] = []
  const script: Array<() => Response> = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const ids = init?.body ? (JSON.parse(String(init.body)) as { ids: string[] }).ids : undefined
    calls.push({ method, url, ...(ids ? { ids } : {}) })
    const next = script.shift()
    if (next) {
      return next()
    }
    if (ids) {
      return Response.json(ids.map((id) => ({ id, content: { text: id } })))
    }
    const id = url.split('/entries/')[1]?.split('/')[0]
    return Response.json({ content: { text: id } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, script }
}

const tooMany = (seconds: string) => () =>
  Response.json({ code: 'RATE_LIMITED' }, { status: 429, headers: { 'retry-after': seconds } })

/** Let queued microtasks and resolved fetches run. */
const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  setCurrentBoard('b1')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loadEntryContent', () => {
  it('sends the asks of one tick as a single batch request and hands each entry its content', async () => {
    const api = fakeApi()
    const got = new Map<string, unknown>()
    for (const id of ['e1', 'e2', 'e3']) {
      loadEntryContent(id, 0, (c) => got.set(id, c))
    }
    await settle()
    expect(api.calls).toEqual([
      {
        method: 'POST',
        url: '/api/boards/b1/entries/content',
        ids: ['e1', 'e2', 'e3'],
      },
    ])
    expect(got).toEqual(
      new Map([
        ['e1', { text: 'e1' }],
        ['e2', { text: 'e2' }],
        ['e3', { text: 'e3' }],
      ]),
    )
  })

  it('splits a large mount into batches of at most 200 ids', async () => {
    const api = fakeApi()
    let loaded = 0
    for (let i = 0; i < 450; i++) {
      loadEntryContent(`e${i}`, 0, () => {
        loaded += 1
      })
    }
    await settle()
    expect(api.calls.map((c) => c.ids?.length)).toEqual([200, 200, 50])
    expect(loaded).toBe(450)
  })

  it('retries a rate-limited load after Retry-After, without anything else happening', async () => {
    const api = fakeApi()
    api.script.push(tooMany('2'))
    const onLoad = vi.fn()
    loadEntryContent('e1', 0, onLoad)
    await settle()
    expect(api.calls).toHaveLength(1)
    expect(onLoad).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1999)
    expect(api.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.calls).toHaveLength(2)
    expect(onLoad).toHaveBeenCalledWith({ text: 'e1' })
  })

  it('retries a failed batch as one batch again, and honours a Retry-After above the backoff cap', async () => {
    const api = fakeApi()
    api.script.push(tooMany('52'))
    const onLoad = vi.fn()
    for (const id of ['e1', 'e2', 'e3']) {
      loadEntryContent(id, 0, onLoad)
    }
    await settle()
    await vi.advanceTimersByTimeAsync(51_999)
    expect(api.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.calls.map((c) => c.ids)).toEqual([
      ['e1', 'e2', 'e3'],
      ['e1', 'e2', 'e3'],
    ])
    expect(onLoad).toHaveBeenCalledTimes(3)
  })

  it('backs off exponentially on failures without Retry-After (server errors, network errors)', async () => {
    const api = fakeApi()
    api.script.push(
      () => new Response('', { status: 502 }),
      () => {
        throw new TypeError('Failed to fetch')
      },
    )
    const onLoad = vi.fn()
    loadEntryContent('e1', 0, onLoad)
    await settle()
    await vi.advanceTimersByTimeAsync(1000) // first retry after 1 s
    expect(api.calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(api.calls).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1) // second retry after 2 s
    expect(api.calls).toHaveLength(3)
    expect(onLoad).toHaveBeenCalledTimes(1)
  })

  it('neither delivers nor retries an ask that was cancelled (the entry unmounted)', async () => {
    const api = fakeApi()
    api.script.push(tooMany('1'))
    const onLoad = vi.fn()
    const cancel = loadEntryContent('e1', 0, onLoad)
    await settle()
    cancel()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.calls).toHaveLength(1)
    expect(onLoad).not.toHaveBeenCalled()

    // Cancelled before it was even sent: no request at all.
    const before = api.calls.length
    loadEntryContent('e2', 0, onLoad)()
    await settle()
    expect(api.calls).toHaveLength(before)
  })

  it('drops an id the server does not return (deleted or not visible) without retrying', async () => {
    const api = fakeApi()
    api.script.push(() => Response.json([{ id: 'e1', content: { text: 'one' } }]))
    const one = vi.fn()
    const gone = vi.fn()
    loadEntryContent('e1', 0, one)
    loadEntryContent('gone', 0, gone)
    await settle()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.calls).toHaveLength(1)
    expect(one).toHaveBeenCalledWith({ text: 'one' })
    expect(gone).not.toHaveBeenCalled()
  })

  it('loads each entry on its own over a share link (the public tree is GET-only)', async () => {
    const api = fakeApi()
    setPublicToken('tok')
    const onLoad = vi.fn()
    loadEntryContent('e1', 0, onLoad)
    loadEntryContent('e2', 3, onLoad)
    await settle()
    expect(api.calls).toEqual([
      { method: 'GET', url: '/api/public/tok/entries/e1/content' },
      { method: 'GET', url: '/api/public/tok/entries/e2/content?v=3' },
    ])
    expect(onLoad).toHaveBeenCalledTimes(2)
  })
})
