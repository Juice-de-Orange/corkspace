import { admin } from './admin'
import { auth } from './auth'
import { boards } from './boards'
import { canvas } from './canvas'
import { commands } from './commands'
import { common } from './common'
import { forms } from './forms'
import { shell } from './shell'
import { toolbar } from './toolbar'
import type { Catalog } from './types'

/** The full message catalog — every namespace merged. Adding a namespace = one import + one spread. */
export const MESSAGES = {
  ...common,
  ...auth,
  ...shell,
  ...toolbar,
  ...canvas,
  ...boards,
  ...admin,
  ...forms,
  ...commands,
} satisfies Catalog

export type MessageKey = keyof typeof MESSAGES
