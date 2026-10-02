import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { boards } from './boards'

export const feedbackKindEnum = pgEnum('feedback_kind', ['bug', 'wish'])
export const feedbackStatusEnum = pgEnum('feedback_status', ['open', 'done'])

/** User-submitted feedback: a bug report or an improvement wish, with an optional screenshot
 *  (a data-URL of the current board view). `created_by` is the submitter's user id (nullable,
 *  ON DELETE SET NULL — authorship is metadata). Feedback stays GLOBAL (reviewed centrally by the
 *  super-admin); `board_id` stamps which board it was sent from (nullable; set null so deleting a
 *  board keeps the feedback). */
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: feedbackKindEnum('kind').notNull(),
  message: text('message').notNull(),
  context: text('context'), // free-form (URL / viewport / user agent)
  screenshot: text('screenshot'), // optional data URL (image/jpeg)
  status: feedbackStatusEnum('status').notNull().default('open'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
