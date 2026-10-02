import type { LinkPreview } from '@corkspace/shared'

export async function apiLinkPreview(url: string): Promise<LinkPreview> {
  const res = await fetch('/api/links/preview', {
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
