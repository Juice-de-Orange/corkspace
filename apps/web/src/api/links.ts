import type { LinkPreview } from '@corkspace/shared'
import { boardApi } from './board-context'

export async function apiLinkPreview(url: string): Promise<LinkPreview> {
  const res = await fetch(boardApi('/links/preview'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    throw new Error(`preview failed: ${res.status}`)
  }
  return res.json() as Promise<LinkPreview>
}
