import { assetApi, boardApi } from './board-context'

export interface AssetRef {
  id: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
}

export interface AssetStatus {
  status: 'pending' | 'processing' | 'ready' | 'failed'
  variants: Record<string, string>
  width: number | null
  height: number | null
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`asset request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function apiUploadAsset(file: File): Promise<AssetRef> {
  const fd = new FormData()
  fd.append('file', file)
  return asJson<AssetRef>(
    await fetch(boardApi('/assets'), { method: 'POST', credentials: 'include', body: fd }),
  )
}

export async function apiAssetFromUrl(url: string): Promise<AssetRef> {
  return asJson<AssetRef>(
    await fetch(boardApi('/assets/from-url'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}

export async function apiAssetStatus(id: string): Promise<AssetStatus> {
  return asJson<AssetStatus>(await fetch(`/api/assets/${id}/status`, { credentials: 'include' }))
}

/** Asset serve URL — public-token aware (routes to /api/public/:token/assets/:id in read-only mode). */
export function assetUrl(id: string, variant = 'full'): string {
  return assetApi(id, variant)
}

/** Poll an asset until it is ready (or failed / timeout). */
export async function waitForAsset(id: string, timeoutMs = 30_000): Promise<AssetStatus> {
  const start = Date.now()
  for (;;) {
    const s = await apiAssetStatus(id)
    if (s.status === 'ready' || s.status === 'failed') {
      return s
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('asset processing timed out')
    }
    await new Promise((r) => setTimeout(r, 350))
  }
}
