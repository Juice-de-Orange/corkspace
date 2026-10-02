import { describe, expect, it } from 'vitest'
import { parseLinkPreview } from './link-preview'

describe('parseLinkPreview', () => {
  it('extracts OpenGraph tags', () => {
    const html = `
      <html><head>
        <title>Fallback Title</title>
        <meta property="og:title" content="OG Title &amp; More" />
        <meta property="og:description" content="A nice description" />
        <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
        <meta property="og:site_name" content="Example" />
      </head></html>`
    const p = parseLinkPreview('https://example.com/article', html)
    expect(p.url).toBe('https://example.com/article')
    expect(p.title).toBe('OG Title & More')
    expect(p.description).toBe('A nice description')
    expect(p.image).toBe('https://cdn.example.com/cover.jpg')
    expect(p.siteName).toBe('Example')
  })

  it('falls back to <title> and twitter/description tags', () => {
    const html = `
      <title>Just A Title</title>
      <meta name="twitter:image" content="https://x/y.png">
      <meta name="description" content="meta desc">`
    const p = parseLinkPreview('https://x.io', html)
    expect(p.title).toBe('Just A Title')
    expect(p.description).toBe('meta desc')
    expect(p.image).toBe('https://x/y.png')
    expect(p.siteName).toBeUndefined()
  })

  it('handles content-before-property ordering and missing metadata', () => {
    const html = '<meta content="Reversed" property="og:title">'
    expect(parseLinkPreview('https://x', html).title).toBe('Reversed')
    expect(parseLinkPreview('https://x', '<html></html>')).toEqual({ url: 'https://x' })
  })
})
