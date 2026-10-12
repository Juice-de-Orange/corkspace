import { atom } from 'signia'

/** The instance's name (`BRAND_NAME` on the server), shown in the header, on the sign-in page and
 *  in the browser tab. Starts with the default and is replaced once `/api/instance` answers. */
export const brandAtom = atom<string>('brand', 'Corkspace')

/** Load the brand from the server; keeps the default if the request fails. */
export async function loadBrand(): Promise<void> {
  try {
    const res = await fetch('/api/instance', { credentials: 'include' })
    if (!res.ok) {
      return
    }
    const body = (await res.json()) as { brandName?: unknown }
    if (typeof body.brandName === 'string' && body.brandName.length > 0) {
      brandAtom.set(body.brandName)
      document.title = body.brandName
    }
  } catch {
    // Offline or api not up yet: the default name stays.
  }
}

/** A file name stem derived from the brand, e.g. "Family pinboard" → "family-pinboard". */
export function brandFileStem(brand: string): string {
  const stem = brand
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'board'
}
