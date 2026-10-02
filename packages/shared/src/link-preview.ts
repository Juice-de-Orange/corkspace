export interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim()
}

function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/[:]/g, '\\:')
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${k}["'][^>]*\\bcontent=["']([^"']*)["']`,
    'i',
  )
  const b = new RegExp(
    `<meta[^>]+\\bcontent=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`,
    'i',
  )
  const m = html.match(a) ?? html.match(b)
  return m?.[1] ? decodeEntities(m[1]) : undefined
}

/** Extract OpenGraph/Twitter/title metadata from an HTML string (regex-based; no DOM). */
export function parseLinkPreview(url: string, html: string): LinkPreview {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const preview: LinkPreview = { url }
  const title =
    metaContent(html, 'og:title') ??
    metaContent(html, 'twitter:title') ??
    (titleTag ? decodeEntities(titleTag) : undefined)
  const description =
    metaContent(html, 'og:description') ??
    metaContent(html, 'twitter:description') ??
    metaContent(html, 'description')
  const image = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image')
  const siteName = metaContent(html, 'og:site_name')
  if (title) preview.title = title
  if (description) preview.description = description
  if (image) preview.image = image
  if (siteName) preview.siteName = siteName
  return preview
}
