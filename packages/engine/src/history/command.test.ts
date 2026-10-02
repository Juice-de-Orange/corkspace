import { describe, expect, it } from 'vitest'
import { type Command, CommandStack } from './command'

const setCmd = (s: { v: number }, from: number, to: number): Command => ({
  type: 'set',
  do: () => {
    s.v = to
  },
  undo: () => {
    s.v = from
  },
})

/** A move command that coalesces with same-key moves, preserving the original undo. */
function moveCmd(s: { v: number }, from: number, to: number): Command {
  const undo = () => {
    s.v = from
  }
  const coalesce = (next: Command): Command => ({ ...next, undo, coalesce })
  return {
    type: 'move',
    coalesceKey: 'move-e1',
    do: () => {
      s.v = to
    },
    undo,
    coalesce,
  }
}

describe('CommandStack', () => {
  it('executes, undoes and redoes', async () => {
    const s = { v: 0 }
    const stack = new CommandStack()
    await stack.execute(setCmd(s, 0, 1))
    expect(s.v).toBe(1)
    expect(stack.canUndo()).toBe(true)
    expect(stack.canRedo()).toBe(false)
    expect(await stack.undo()).toBe(true)
    expect(s.v).toBe(0)
    expect(stack.canRedo()).toBe(true)
    expect(await stack.redo()).toBe(true)
    expect(s.v).toBe(1)
  })

  it('returns false on undo/redo when empty', async () => {
    const stack = new CommandStack()
    expect(await stack.undo()).toBe(false)
    expect(await stack.redo()).toBe(false)
  })

  it('clears the redo stack on a fresh execute', async () => {
    const s = { v: 0 }
    const stack = new CommandStack()
    await stack.execute(setCmd(s, 0, 1))
    await stack.undo()
    expect(stack.canRedo()).toBe(true)
    await stack.execute(setCmd(s, 0, 2))
    expect(stack.canRedo()).toBe(false)
  })

  it('coalesces same-key commands into one undo step', async () => {
    const s = { v: 0 }
    const stack = new CommandStack()
    await stack.execute(moveCmd(s, 0, 1))
    await stack.execute(moveCmd(s, 1, 2))
    await stack.execute(moveCmd(s, 2, 3))
    expect(s.v).toBe(3)
    expect(stack.depth).toBe(1)
    await stack.undo()
    expect(s.v).toBe(0)
  })

  it('keeps commands separate when coalesce returns null', async () => {
    const s = { v: 0 }
    const stack = new CommandStack()
    const c = (to: number): Command => ({
      type: 'x',
      coalesceKey: 'k',
      do: () => {
        s.v = to
      },
      undo: () => {},
      coalesce: () => null,
    })
    await stack.execute(c(1))
    await stack.execute(c(2))
    expect(stack.depth).toBe(2)
  })

  it('trims to the configured limit', async () => {
    const s = { v: 0 }
    const stack = new CommandStack({ limit: 3 })
    for (let i = 0; i < 5; i++) {
      await stack.execute(setCmd(s, i, i + 1))
    }
    expect(stack.depth).toBe(3)
  })

  it('clears both stacks and notifies onChange', async () => {
    let calls = 0
    const s = { v: 0 }
    const stack = new CommandStack({ onChange: () => calls++ })
    await stack.execute(setCmd(s, 0, 1))
    await stack.undo()
    stack.clear()
    expect(stack.canUndo()).toBe(false)
    expect(stack.canRedo()).toBe(false)
    expect(calls).toBeGreaterThanOrEqual(3)
  })
})
