import { CommandStack } from '@corkspace/engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCurrentBoard } from '../api/board-context'
import { loadStrokes, strokesAtom } from '../canvas/state/stroke-store'
import { createStrokeCommand, deleteStrokeCommand } from './stroke-commands'

const input = { points: [[0, 0, 0.5]], color: '#000', size: 4, tool: 'pen' }

// Server ids are unique across tests, like the UUIDs of the real API.
let seq = 0

/** A fake strokes API. Creates answer only when the test releases them, like a slow network. */
function fakeServer() {
  const live = new Set<string>()
  const held: Array<() => void> = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'POST') {
      const id = `real-${++seq}`
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      await new Promise<void>((resolve) => held.push(resolve))
      live.add(id)
      return new Response(JSON.stringify({ id, entryId: null, ...body }), { status: 201 })
    }
    if (method === 'DELETE') {
      const id = url.split('/').pop() ?? ''
      return new Response(null, { status: live.delete(id) ? 200 : 404 })
    }
    return new Response('[]')
  })
  /** Let every held create answer, then let the callers finish. */
  const release = async () => {
    for (const r of held.splice(0)) {
      r()
    }
    await new Promise((r) => setTimeout(r, 0))
  }
  return { live, fetchMock, release }
}

const shown = () => [...strokesAtom.value.keys()]
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('erasing a stroke whose save is still running (#7)', () => {
  let server: ReturnType<typeof fakeServer>
  let stack: CommandStack

  beforeEach(() => {
    setCurrentBoard('b1')
    loadStrokes([])
    server = fakeServer()
    stack = new CommandStack()
    vi.stubGlobal('fetch', server.fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function drawThenEraseWhilePending() {
    const drawn = stack.execute(createStrokeCommand(input))
    await tick()
    const pending = strokesAtom.value.values().next().value
    expect(pending?.id).toMatch(/^temp-/) // shown at once, save still running
    if (!pending) {
      throw new Error('no pending stroke')
    }
    const erased = stack.execute(deleteStrokeCommand(pending))
    await tick()
    expect(shown()).toEqual([]) // gone at once
    await server.release()
    await Promise.all([drawn, erased])
    await tick()
  }

  it('stays gone locally and is deleted on the server once its real id is known', async () => {
    await drawThenEraseWhilePending()
    expect(shown()).toEqual([])
    expect(server.live.size).toBe(0)
  })

  it('undo brings the stroke back, undo again removes it, redo twice ends without it', async () => {
    await drawThenEraseWhilePending()

    const undoErase = stack.undo() // re-creates the stroke on the server
    await tick()
    await server.release()
    await undoErase
    expect(shown()).toHaveLength(1)
    expect(server.live.size).toBe(1)

    await stack.undo() // undo the drawing
    expect(shown()).toEqual([])
    expect(server.live.size).toBe(0)

    const redoDraw = stack.redo()
    await tick()
    await server.release()
    await redoDraw
    expect(shown()).toHaveLength(1)
    expect(server.live.size).toBe(1)

    await stack.redo() // redo the erase
    expect(shown()).toEqual([])
    expect(server.live.size).toBe(0)
  })
})

describe('erasing a saved stroke', () => {
  let server: ReturnType<typeof fakeServer>
  let stack: CommandStack

  beforeEach(() => {
    setCurrentBoard('b1')
    loadStrokes([])
    server = fakeServer()
    stack = new CommandStack()
    vi.stubGlobal('fetch', server.fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draw, erase, undo, undo leaves nothing behind (locally and on the server)', async () => {
    const drawn = stack.execute(createStrokeCommand(input))
    await tick()
    await server.release()
    await drawn
    const saved = strokesAtom.value.values().next().value
    if (!saved) {
      throw new Error('no stroke')
    }
    await stack.execute(deleteStrokeCommand(saved))
    expect(shown()).toEqual([])
    expect(server.live.size).toBe(0)

    const undoErase = stack.undo()
    await tick()
    await server.release()
    await undoErase
    expect(shown()).toHaveLength(1)

    await stack.undo() // undo the drawing: the re-created stroke must go too
    expect(shown()).toEqual([])
    expect(server.live.size).toBe(0)
  })
})
