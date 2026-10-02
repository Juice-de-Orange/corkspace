import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { boards } from './boards'
import { entries } from './entries'

export const strokeToolEnum = pgEnum('stroke_tool', ['pen', 'marker', 'line', 'arrow', 'rect'])

/** Freehand/vector strokes. `entry_id` null = drawn on the board layer; otherwise annotates an entry. */
export const strokes = pgTable(
  'strokes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id').references(() => entries.id, { onDelete: 'cascade' }),
    // Board scoping (M1). Board-layer strokes (entry_id null) have no entry to inherit from,
    // so every stroke carries board_id directly; one predicate covers both layers.
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    points: jsonb('points').$type<number[][]>().notNull(),
    color: text('color').notNull(),
    size: real('size').notNull(),
    tool: strokeToolEnum('tool').notNull().default('pen'),
    minX: doublePrecision('min_x').notNull(),
    minY: doublePrecision('min_y').notNull(),
    maxX: doublePrecision('max_x').notNull(),
    maxY: doublePrecision('max_y').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('strokes_entry_idx').on(t.entryId), index('strokes_board_idx').on(t.boardId)],
)

/** Red-thread connections between exactly two entries. */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Board scoping (M1). Denormalized so the board filter is one indexed predicate, and both
    // endpoints must share this board_id (enforced at write) — structurally no cross-board threads.
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    fromEntryId: uuid('from_entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    toEntryId: uuid('to_entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    color: text('color').notNull().default('#dc2626'),
    label: text('label'),
    arrowStart: boolean('arrow_start').notNull().default(false),
    arrowEnd: boolean('arrow_end').notNull().default(true),
    curveStyle: text('curve_style').notNull().default('bezier'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('connections_from_idx').on(t.fromEntryId),
    index('connections_to_idx').on(t.toEntryId),
    index('connections_board_idx').on(t.boardId),
  ],
)
