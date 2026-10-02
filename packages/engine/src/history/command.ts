/**
 * Generic, framework-agnostic undo/redo command stack. Concrete effectful commands (which call
 * the API + mutate web stores) live in apps/web; this only orchestrates do/undo/redo + coalescing.
 * Every board mutation is executed through `CommandStack.execute`, which is how the
 * "undo/redo covers every mutation" invariant (Phase 6) is guaranteed from creation.
 */
export interface Command {
  type: string
  /** i18n key for the command label (shown in undo history, Phase 6). */
  labelKey?: string
  do: () => void | Promise<void>
  undo: () => void | Promise<void>
  /** Commands sharing a coalesceKey may merge (e.g. a continuous drag → one undo step). */
  coalesceKey?: string
  /** Merge `next` into this command, returning the merged command (or null to keep separate). */
  coalesce?: (next: Command) => Command | null
}

export interface CommandStackOptions {
  /** Max retained undo entries (oldest dropped). */
  limit?: number
  onChange?: () => void
}

export class CommandStack {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private readonly limit: number
  private readonly onChange: (() => void) | undefined

  constructor(options: CommandStackOptions = {}) {
    this.limit = options.limit ?? 200
    this.onChange = options.onChange
  }

  async execute(cmd: Command): Promise<void> {
    await cmd.do()
    const top = this.undoStack.at(-1)
    if (top && cmd.coalesceKey && top.coalesceKey === cmd.coalesceKey && top.coalesce) {
      const merged = top.coalesce(cmd)
      if (merged) {
        this.undoStack[this.undoStack.length - 1] = merged
      } else {
        this.undoStack.push(cmd)
      }
    } else {
      this.undoStack.push(cmd)
    }
    this.redoStack = []
    this.trim()
    this.onChange?.()
  }

  async undo(): Promise<boolean> {
    const cmd = this.undoStack.pop()
    if (!cmd) {
      return false
    }
    await cmd.undo()
    this.redoStack.push(cmd)
    this.onChange?.()
    return true
  }

  async redo(): Promise<boolean> {
    const cmd = this.redoStack.pop()
    if (!cmd) {
      return false
    }
    await cmd.do()
    this.undoStack.push(cmd)
    this.onChange?.()
    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }
  canRedo(): boolean {
    return this.redoStack.length > 0
  }
  get depth(): number {
    return this.undoStack.length
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.onChange?.()
  }

  private trim(): void {
    if (this.undoStack.length > this.limit) {
      this.undoStack.splice(0, this.undoStack.length - this.limit)
    }
  }
}
