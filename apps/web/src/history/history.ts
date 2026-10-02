import { CommandStack } from '@corkspace/engine'

/** The single board-wide command stack. Every mutation runs through `history.execute`.
 *  The undo/redo UI + keyboard shortcuts land in Phase 6; this is the entrypoint. */
export const history = new CommandStack({ limit: 200 })
