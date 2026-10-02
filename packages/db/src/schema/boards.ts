import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * Multi-tenant board model (M1). Every content row (entries/strokes/connections/frames/
 * teleports/tags/assets) is scoped to a `board`. Ownership lives ONLY on `boards.owner_id`
 * (single source of truth); invited registered users are `board_members` (editor|viewer);
 * account-less external read links are `board_shares` (viewer, public-only). Global default
 * appearance settings live in the `app_settings` singleton; per-board overrides in
 * `boards.settings`. See docs/adr/.
 */

export const boardMemberRoleEnum = pgEnum('board_member_role', ['editor', 'viewer'])

/** A personal board. One per user (unique owner) — auto-created on account creation. */
export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('My board'),
    // Per-board appearance overrides (sparse); merged over app_settings.defaults. Shape in @corkspace/shared.
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('boards_owner_id_key').on(t.ownerId)],
)

/** Registered-user membership of a board. The owner is never a member row. */
export const boardMembers = pgTable(
  'board_members',
  {
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: boardMemberRoleEnum('role').notNull(),
    // Whether a viewer member also sees board-layer drawings/frames/teleports ("full board look").
    showFurniture: boolean('show_furniture').notNull().default(true),
    invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.boardId, t.userId] }),
    index('board_members_user_idx').on(t.userId),
  ],
)

/** External, account-less read link (capability token). Viewer access, public entries only. */
export const boardShares = pgTable(
  'board_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    label: text('label'),
    showFurniture: boolean('show_furniture').notNull().default(true),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    // Revocation = set, don't delete (audit). Access requires revoked_at IS NULL and (expires_at null or future).
    revokedAt: timestamp('revoked_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('board_shares_board_idx').on(t.boardId)],
)

/** Global default appearance settings (super-admin owned). Single row, id = 'global'. */
export const appSettings = pgTable(
  'app_settings',
  {
    id: text('id').primaryKey().default('global'),
    defaults: jsonb('defaults').$type<Record<string, unknown>>().notNull().default({}),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [check('app_settings_singleton', sql`${t.id} = 'global'`)],
)
