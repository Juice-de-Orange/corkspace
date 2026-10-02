/**
 * The current board context for all API calls. Authed users work against
 * `/api/boards/:boardId/*`; an external share link works against the GET-only
 * `/api/public/:token/*` tree. Every fetcher routes its path through `boardApi()` /
 * `assetApi()` so a single place decides the tenant + mode.
 *
 * NB: a board/account switch is a client-side navigation (a React remount, NOT a page reload), so
 * this module var — like the undo `history` — persists across it. `useLoadBoard` updates it per
 * board and resets the per-tenant transient client state (see `resetBoardClientState`).
 */

let currentBoardId: string | null = null
let publicToken: string | null = null

export function setCurrentBoard(boardId: string): void {
  currentBoardId = boardId
  publicToken = null
}

/** Enter external read-only mode for a share token (no session). */
export function setPublicToken(token: string): void {
  publicToken = token
  currentBoardId = null
}

/** Build a board-scoped API path (`sub` starts with '/'), routing to the public tree in token mode. */
export function boardApi(sub: string): string {
  if (publicToken) {
    return `/api/public/${encodeURIComponent(publicToken)}${sub}`
  }
  if (!currentBoardId) {
    throw new Error('boardApi called before a board was set')
  }
  return `/api/boards/${currentBoardId}${sub}`
}

/** Asset serve URL — public-token aware. */
export function assetApi(id: string, variant = 'full'): string {
  const q = `?v=${encodeURIComponent(variant)}`
  if (publicToken) {
    return `/api/public/${encodeURIComponent(publicToken)}/assets/${id}${q}`
  }
  return `/api/assets/${id}${q}`
}
