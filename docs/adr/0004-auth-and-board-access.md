# ADR 0004 — Better Auth with admin-created accounts and a board-scoped access model

## Status

Accepted.

## Context

Corkspace is a private, invitation-only space: no anonymous editing, no public sign-up. It started
as a single board with one administrator and read-only viewer accounts and grew into one board per
account with invited editors and viewers plus account-less read-only links. Authorisation mistakes
here leak private entries, so the rules must live in one place on the server.

## Decision

- **Better Auth** (TypeScript-first, Drizzle adapter) provides email + password login with argon2id
  hashing (`@node-rs/argon2`), httpOnly session cookies (secure in production), trusted-origin CSRF
  protection and rate limiting in production. Its tables are defined by hand in
  `packages/db/src/schema/auth.ts`.
- **Open sign-up is disabled** (`disableSignUp`). The first administrator is seeded from
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` on api start; further accounts are created by
  administrators via `/admin` (`POST /api/admin/users`) and each gets a personal board.
- **Instance role** `user.role` is `admin` or `user`. Administrators manage accounts and global
  defaults and may read any board for moderation, but **edit rights never come from the role**.
  Guards prevent demoting the last administrator (checked inside the transaction with
  `SELECT … FOR UPDATE`) and deleting yourself.
- **Board access** is resolved by `resolveBoardAccess` / `resolveShareToken` in
  `apps/api/src/services/board-access.ts` into `{ level, canEdit, canSeePrivate, canSeeFurniture }`
  from `boards.owner_id`, `board_members` (`editor` | `viewer`) and `board_shares` (capability
  tokens with revoke and expiry). Every read uses `boardVisibilityWhere(access)`; every mutation
  carries `board_id = :boardId` in its `WHERE`.
- **Route structure makes mistakes hard**: content routes live under `/api/boards/:boardId/*`
  behind `boardContext` (unknown or inaccessible boards return 404, hiding existence); the
  account-less tree `/api/public/:token/*` registers GET handlers only.

## Consequences

- Viewers and share links never receive a private entry — and never a connection or anchored stroke
  that touches one; `board-rbac.integration.test.ts` proves this by calling the API directly and
  asserting on response bodies. Any new route needs the same kind of test.
- The web app hides edit controls for read-only access, but that is cosmetic; the server is the
  authority.
- SMTP settings exist in the environment schema, but password-reset and invitation emails are not
  implemented yet; administrators reset passwords in `/admin`.
- Client state that is per board (undo stack, selection, clipboard, loaded entries) must be reset on
  a board or account switch, because switching is a client-side navigation (see
  [ADR 0007](0007-client-state-and-local-storage.md)).
