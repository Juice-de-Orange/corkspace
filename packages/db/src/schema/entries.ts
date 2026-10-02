import { sql } from 'drizzle-orm'
import {
  customType,
  doublePrecision,
  index,
  integer,
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

/** Postgres tsvector column (no native Drizzle type). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

export const entryTypeEnum = pgEnum('entry_type', ['sticky', 'doc', 'checklist', 'image', 'link'])
export const visibilityEnum = pgEnum('visibility', ['public', 'private'])
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'ready', 'failed'])

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalPath: text('original_path'),
  mime: text('mime'),
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes'),
  variants: jsonb('variants').$type<Record<string, string>>().notNull().default({}),
  processingStatus: jobStatusEnum('processing_status').notNull().default('pending'),
  sourceUrl: text('source_url'),
  // Board scoping (M1). An asset belongs to exactly one board; serving is scoped by board access.
  boardId: uuid('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: entryTypeEnum('type').notNull(),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull(),
    rotation: real('rotation').notNull().default(0),
    zIndex: integer('z_index').notNull().default(0),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    color: text('color'),
    content: jsonb('content').notNull().default({}),
    imageAssetId: uuid('image_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    // Board scoping (M1) — the root tenant unit; every other content row inherits from here.
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    // Server-maintained plain text (feeds ts_headline snippets) + a generated tsvector for search.
    searchText: text('search_text').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`to_tsvector('simple', coalesce(search_text, ''))`,
    ),
    // Authorship is metadata (nullable + set null), NOT ownership — ownership is boards.owner_id.
    // Set null so deleting a user who authored on someone else's board never wedges (M1).
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    // Editor attribution — set to the acting user on every patch (M1 collaboration).
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('entries_search_idx').using('gin', t.searchVector),
    index('entries_type_idx').on(t.type),
    index('entries_created_at_idx').on(t.createdAt),
    index('entries_deleted_at_idx').on(t.deletedAt),
    index('entries_board_idx').on(t.boardId, t.deletedAt),
  ],
)

export const entryVersions = pgTable(
  'entry_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    snapshot: jsonb('snapshot').notNull(),
    versionAt: timestamp('version_at').notNull().defaultNow(),
  },
  (t) => [index('entry_versions_entry_idx').on(t.entryId, t.versionAt)],
)
