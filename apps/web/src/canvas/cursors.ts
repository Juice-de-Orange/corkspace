import type { DrawTool } from './state/stroke-store'

/** Hand-tool cursors: with a tool armed the pointer IS the tool — a pencil whose nib carries the
 *  current ink colour, a chisel marker, an eraser block. 32×32 inline SVG, hotspot at the tip,
 *  with a white halo so the cursor reads on cork and in dark mode. Keyword fallbacks per spec. */

const cache = new Map<string, string>()

const svgUrl = (svg: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">${svg}</svg>`)}")`

/** Pencil along the ↗ diagonal, tip at (4,28); the nib is tinted with the ink colour. */
const penSvg = (color: string): string =>
  `<path d="M4 28 L7.7 19.7 L21.7 5.7 L24.7 2.7 L29.3 7.3 L26.3 10.3 L12.3 24.3 Z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>` +
  `<path d="M4 28 L12.3 24.3 L7.7 19.7 Z" fill="${color}"/>` +
  `<path d="M7.7 19.7 L12.3 24.3 L26.3 10.3 L21.7 5.7 Z" fill="#eab308" stroke="#3b2f22" stroke-width="0.8"/>` +
  `<path d="M21.7 5.7 L26.3 10.3 L29.3 7.3 L24.7 2.7 Z" fill="#c0453d" stroke="#3b2f22" stroke-width="0.8"/>`

/** Chisel marker, flat tinted tip at (4,28), dark body. */
const markerSvg = (color: string): string =>
  `<path d="M3 27.4 L4.6 29 L14.6 24.4 L26.6 12.4 L28.4 6.4 L25.6 3.6 L19.6 5.4 L7.6 17.4 Z" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>` +
  `<path d="M3 27.4 L4.6 29 L14.6 24.4 L7.6 17.4 Z" fill="${color}" stroke="#3b2f22" stroke-width="0.8"/>` +
  `<path d="M7.6 17.4 L14.6 24.4 L26.6 12.4 L19.6 5.4 Z" fill="#374151" stroke="#111827" stroke-width="0.8"/>` +
  `<path d="M19.6 5.4 L26.6 12.4 L28.4 6.4 L25.6 3.6 Z" fill="#6b7280" stroke="#111827" stroke-width="0.8"/>`

/** Two-tone eraser block, contact corner at (5,27). */
const eraserSvg = (): string =>
  `<path d="M3.4 24.6 L7.4 28.6 L21 15 L17 11 Z" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>` +
  `<path d="M3.4 24.6 L7.4 28.6 L13 23 L9 19 Z" fill="#f6a8b8" stroke="#3b2f22" stroke-width="0.9"/>` +
  `<path d="M9 19 L13 23 L21 15 L17 11 Z" fill="#94a3b8" stroke="#3b2f22" stroke-width="0.9"/>`

/** CSS cursor for the armed tool (colour-aware, cached). */
export function toolCursor(tool: DrawTool | null, connectTool: boolean, penColor: string): string {
  if (tool === 'pen' || tool === 'marker' || tool === 'eraser') {
    const key = `${tool}:${penColor}`
    const hit = cache.get(key)
    if (hit) {
      return hit
    }
    const value =
      tool === 'pen'
        ? `${svgUrl(penSvg(penColor))} 4 28, crosshair`
        : tool === 'marker'
          ? `${svgUrl(markerSvg(penColor))} 4 28, crosshair`
          : `${svgUrl(eraserSvg())} 5 27, cell`
    cache.set(key, value)
    return value
  }
  if (tool || connectTool) {
    return 'crosshair' // shape tools drag geometry; Verbinden shows the docking badge
  }
  return 'grab'
}
