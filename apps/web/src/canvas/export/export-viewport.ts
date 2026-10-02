/**
 * Export the current board viewport as a PNG or PDF. Heavy libraries (html-to-image, jspdf) are
 * dynamically imported so they are code-split out of the main bundle. Chrome marked with
 * `data-export-ignore` (toolbars, dashboard, minimap, readout) is excluded from the capture.
 */

const CORK_BG = '#cfc9bd'

function excludeChrome(node: HTMLElement): boolean {
  return !node.hasAttribute('data-export-ignore')
}

/** Capture the visible board (`.canvas-root`, minus chrome) as a PNG data URL, or null. */
export async function captureViewportPng(): Promise<string | null> {
  const root = document.querySelector<HTMLElement>('.canvas-root')
  if (!root) {
    return null
  }
  const { toPng } = await import('html-to-image')
  return toPng(root, {
    filter: (node) => !(node instanceof HTMLElement) || excludeChrome(node),
    backgroundColor: CORK_BG,
    pixelRatio: 2,
    cacheBust: true,
  })
}

/**
 * Capture the current board view as a JPEG data URL (smaller than PNG) for attaching to feedback.
 * Unlike the export, this KEEPS the chrome (toolbars/panels) so a bug report shows the real UI.
 */
export async function captureViewportJpeg(quality = 0.7): Promise<string | null> {
  const root = document.querySelector<HTMLElement>('.canvas-root')
  if (!root) {
    return null
  }
  const { toJpeg } = await import('html-to-image')
  return toJpeg(root, { backgroundColor: CORK_BG, quality, pixelRatio: 1, cacheBust: true })
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function exportViewportPng(filename = 'corkspace.png'): Promise<void> {
  const url = await captureViewportPng()
  if (url) {
    downloadDataUrl(url, filename)
  }
}

export async function exportViewportPdf(filename = 'corkspace.pdf'): Promise<void> {
  const root = document.querySelector<HTMLElement>('.canvas-root')
  if (!root) {
    return
  }
  const url = await captureViewportPng()
  if (!url) {
    return
  }
  const { jsPDF } = await import('jspdf')
  const w = root.clientWidth || 1024
  const h = root.clientHeight || 768
  const pdf = new jsPDF({ unit: 'px', format: [w, h], compress: true })
  pdf.addImage(url, 'PNG', 0, 0, w, h)
  pdf.save(filename)
}
