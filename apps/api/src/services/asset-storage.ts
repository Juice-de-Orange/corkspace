import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export function extForMime(mime: string): string {
  return EXT[mime] ?? 'bin'
}

/** Absolute path for an asset file given its ASSET_DIR-relative path. */
export function assetPath(dir: string, rel: string): string {
  return path.join(dir, rel)
}

/** Write an uploaded original under `<ASSET_DIR>/<id>/orig.<ext>`; returns the relative path. */
export async function writeOriginal(
  dir: string,
  id: string,
  mime: string,
  buf: Buffer,
): Promise<string> {
  const rel = `${id}/orig.${extForMime(mime)}`
  const abs = assetPath(dir, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, buf)
  return rel
}
